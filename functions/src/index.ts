import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize the Firebase Admin SDK
admin.initializeApp();

/**
 * Representation of an individual item in an Invoice's cart/list.
 */
interface InvoiceLineItem {
  product_id?: string;
  carton_qty?: number;
  unit_qty?: number;
  [key: string]: any; // Allow other client-side fields (price, names, etc.)
}

/**
 * Representation of our consolidated Loadout Sheet line item.
 */
interface AggregatedLoadoutItem {
  product_id: string;
  carton_qty: number;
  unit_qty: number;
}

/**
 * Cloud Function that fires whenever a new document is created in the "InvoiceBatch" collection.
 * It fetches all invoices matching this batch ID, consolidates their product volumes (cartons + units),
 * and generates a single unified Loadout Sheet stored in "LoadoutSheets" collection.
 */
export const aggregateInvoiceBatchOnCreate = onDocumentCreated(
  {
    document: "InvoiceBatch/{batchId}",
    retry: false, // Prevent infinite retry loops on validation failures, configure as needed
  },
  async (event) => {
    const batchId = event.params.batchId;
    const triggerDocPath = event.document;
    const db = admin.firestore();

    logger.info(`Started aggregation for InvoiceBatch with ID: "${batchId}"`, {
      eventTriggerPath: triggerDocPath,
    });

    try {
      // 1. Fetch all individual invoices linked to this batch ID.
      // We look up both camelCase "batchId" and fallback to snake_case "batch_id" if necessary for backward compatibility.
      let invoicesQuerySnapshot = await db
        .collection("Invoices")
        .where("batchId", "==", batchId)
        .get();

      if (invoicesQuerySnapshot.empty) {
        logger.info(`No invoices matched batchId with camelCase. Checking with snake_case "batch_id"...`);
        invoicesQuerySnapshot = await db
          .collection("Invoices")
          .where("batch_id", "==", batchId)
          .get();
      }

      const totalInvoicesFound = invoicesQuerySnapshot.size;
      logger.info(`Retrieved ${totalInvoicesFound} invoices associated with batch: "${batchId}".`);

      if (totalInvoicesFound === 0) {
        const warningMsg = `No invoices found matching Batch ID "${batchId}". Saving empty loading manifest.`;
        logger.warn(warningMsg);
        
        // Save empty / initial loadout sheet for transparency
        await db.collection("LoadoutSheets").add({
          batchId: batchId,
          items: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          invoiceCount: 0,
          status: "EMPTY_BATCH_WARNING",
          generatedBy: "firebase-cloud-function",
          warning: warningMsg,
        });
        return;
      }

      // Dictionary to keep track of aggregated quantities for each unique product_id
      const productAggregateDict: Record<string, AggregatedLoadoutItem> = {};

      // 2. Loop through each invoice and run the aggregation logic
      for (const invoiceDoc of invoicesQuerySnapshot.docs) {
        const invoiceData = invoiceDoc.data();
        const invoiceId = invoiceDoc.id;

        // Validation Rule: Ensure that the invoice has a valid product items property
        if (!invoiceData || !invoiceData.items) {
          throw new Error(
            `Data validation exception: Invoice "${invoiceId}" is missing the required "items" array/collection.`
          );
        }

        const itemsList = invoiceData.items;

        if (!Array.isArray(itemsList)) {
          throw new Error(
            `Type collision exception: The "items" property in invoice "${invoiceId}" is not a valid array.`
          );
        }

        if (itemsList.length === 0) {
          logger.warn(`Invoice "${invoiceId}" exists but carries zero product line items.`);
          continue;
        }

        // Loop through lines in the invoice
        for (const line of itemsList as InvoiceLineItem[]) {
          const productId = line.product_id;

          // Crucial Validation: Check if the product identifier exists
          if (!productId) {
            throw new Error(
              `Integrity error: Found a malformed line item in invoice "${invoiceId}" with a missing "product_id".`
            );
          }

          // Clean up quantities and convert to numerical values (handling empty strings or nulls safely)
          const cartonQty = typeof line.carton_qty === "number" ? line.carton_qty : Number(line.carton_qty || 0);
          const unitQty = typeof line.unit_qty === "number" ? line.unit_qty : Number(line.unit_qty || 0);

          if (isNaN(cartonQty) || isNaN(unitQty)) {
            throw new Error(
              `Integrity error: Non-numeric quantity detected in invoice "${invoiceId}" for product "${productId}". (Cartons: ${line.carton_qty}, Units: ${line.unit_qty})`
            );
          }

          // Sum up the quantities for the unique product_id
          if (!productAggregateDict[productId]) {
            productAggregateDict[productId] = {
              product_id: productId,
              carton_qty: 0,
              unit_qty: 0,
            };
          }

          productAggregateDict[productId].carton_qty += cartonQty;
          productAggregateDict[productId].unit_qty += unitQty;
        }
      }

      // Convert dictionary to array list for standard warehouse representation
      const aggregatedItemsArray = Object.values(productAggregateDict);

      logger.info(`Successfully compiled ${aggregatedItemsArray.length} unique products for loadout aggregate.`);

      // 3. Save the resulting aggregated array as a new document in the "LoadoutSheets" collection
      const loadoutSheetPayload = {
        batchId: batchId,
        items: aggregatedItemsArray,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        invoiceCount: totalInvoicesFound,
        status: "COMPLETED",
        generatedBy: "firebase-cloud-function",
        metadata: {
          triggerTime: event.time,
          runScope: "InvoiceBatch-triggered-consolidation",
        },
      };

      const loadoutDocRef = await db.collection("LoadoutSheets").add(loadoutSheetPayload);

      logger.info(`Successfully stored new LoadoutSheet document for batch: "${batchId}". Document ID: "${loadoutDocRef.id}".`);

    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to aggregate invoices for Batch "${batchId}": ${errorMessage}`, {
        errorStack: err?.stack || "",
      });

      // Save a failure status record so that client sides are aware of the processing error
      try {
        await db.collection("LoadoutSheets").add({
          batchId: batchId,
          items: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "FAILED",
          error: errorMessage,
          generatedBy: "firebase-cloud-function",
        });
        logger.info(`Saved a "FAILED" loadout sheet fallback log inside Firestore.`);
      } catch (logErr) {
        logger.error(`Critical: Could not even write the FAILED state document to Firestore:`, logErr);
      }

      // Re-throw the error to ensure Cloud Function status registry is appropriately flagged
      throw err;
    }
  }
);
