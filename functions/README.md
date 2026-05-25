# PrimeLink DMS – Consolidated Warehouse Loadout Sheet Cloud Function

This directory contains the Firebase Cloud Function written in TypeScript to automate the aggregation of multiple customer invoices into a single unified warehouse loadout sheet.

---

## Architecture & Lifecycle Flow

1. **Trigger Event:** An insert / create operation inside the `InvoiceBatch` collection:
   ```
   InvoiceBatch/{batchId}
   ```
2. **Invoices Fetching:** The function retrieves all invoices in the top-level `Invoices` collection where the relational foreign key `batchId` (or fallback `batch_id`) matches the created batch ID.
3. **Robust Consolidation (Aggregation Engine):**
   - Validates that every retrieved invoice has a valid non-empty nested `items` array.
   - Throws alerts/errors and saves fallback logs if crucial product elements or numeric quantities (cartons or units) are corrupt or missing.
   - Accumulates total quantities of `carton_qty` and `unit_qty` mapping them to each unique, independent `product_id`.
4. **Loadout Formulation:** Saves the consolidated summary into the `LoadoutSheets` collection, referencing back to the source batch ID.

---

## Document Schema Maps

### 1. Firestore Input: `InvoiceBatch` (Trigger)
```json
{
  "id": "batch_swat_001",
  "route": "Swat Valley",
  "salesman": "Representative Name",
  "createdAt": "2026-05-22T12:00:00Z"
}
```

### 2. Firestore Input: `Invoices`
```json
{
  "id": "inv_99812",
  "batchId": "batch_swat_001",
  "customer_shop": "Swat General Store",
  "items": [
    {
      "product_id": "SKU-COLD-V1",
      "carton_qty": 5,
      "unit_qty": 6
    },
    {
      "product_id": "SKU-HOT-Z5",
      "carton_qty": 2,
      "unit_qty": 0
    }
  ],
  "total_amount": 16500
}
```

### 3. Firestore Output: `LoadoutSheets`
```json
{
  "batchId": "batch_swat_001",
  "items": [
    {
      "product_id": "SKU-COLD-V1",
      "carton_qty": 14,
      "unit_qty": 11
    },
    {
      "product_id": "SKU-HOT-Z5",
      "carton_qty": 6,
      "unit_qty": 0
    }
  ],
  "createdAt": "2026-05-22T12:01:05Z",
  "invoiceCount": 3,
  "status": "COMPLETED",
  "generatedBy": "firebase-cloud-function"
}
```

---

## Deployment Procedures

Ensure you have the [Firebase CLI installed](https://firebase.google.com/docs/cli) on your development terminal.

### 1. Install Workspace Dependencies
Inside the `/functions` subdirectory, restore TypeScript compiler libraries:
```bash
npm install
```

### 2. Compile TypeScript Server Elements
Validate compilation structures by running the compiler pipeline:
```bash
npm run build
```

### 3. Run Locally with Local Emulators
For interactive sandbox debug cycles, run local Firebase triggers:
```bash
npm run serve
```

### 4. Deploy to Live Production Project
Deploy only the cloud trigger to your active Firebase Environment:
```bash
firebase deploy --only functions
```

---

## Defensive Quality Guarantees

- **Cross-Key Identification:** Handles database records written with camelCase (`batchId`) as well as snake_case (`batch_id`) keys.
- **Fail-Safe Log Recording:** If processing fails due to missing product fields or unreadable items, a placeholder document in `LoadoutSheets` will be set with a `"FAILED"` status, storing the raw system error details so client UI components can display a graceful "Consolidation Error" message instead of getting stuck loading forever.
- **Null Safety Guards:** Every entry is strictly cast and checked against `isNaN` parameters before running additions.
