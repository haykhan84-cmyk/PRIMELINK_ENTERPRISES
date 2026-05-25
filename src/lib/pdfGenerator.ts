import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// --- ESC/POS Compilation for 58mm/80mm Bluetooth Printers ---
export function compileEscPos(invoice: any): Uint8Array {
  // ESC/POS Commands Constants
  const ESC = 0x1B;
  const GS = 0x1D;

  const init = [ESC, 0x40]; // Initialize
  const center = [ESC, 0x61, 0x01]; // Center align
  const left = [ESC, 0x61, 0x00]; // Left align
  const right = [ESC, 0x61, 0x02]; // Right align
  
  const boldOn = [ESC, 0x45, 0x01]; // Bold ON
  const boldOff = [ESC, 0x45, 0x00]; // Bold OFF
  
  const doubleSize = [GS, 0x21, 0x11]; // Double height and width text
  const normalSize = [GS, 0x21, 0x00]; // Normal size text
  
  const cut = [GS, 0x56, 0x41, 0x03]; // Feed and cut

  const encoder = new TextEncoder();
  const buffer: number[] = [];

  const addBytes = (bytes: number[]) => {
    buffer.push(...bytes);
  };

  const addText = (text: string) => {
    const encoded = encoder.encode(text);
    for (let i = 0; i < encoded.length; i++) {
      buffer.push(encoded[i]);
    }
  };

  // 1. Initialise & Corporate Header
  addBytes(init);
  addBytes(center);
  addBytes(doubleSize);
  addBytes(boldOn);
  addText("PRIMELINK\nENTERPRISES\n");
  addBytes(normalSize);
  addBytes(boldOff);
  addText("FMCG Distribution Division\nSwat Corridor Depot Hub\nPh: 0310-6548820\n");
  addText("--------------------------------\n");
  addBytes(boldOn);
  addText("SALES RECEIPT\n");
  addBytes(boldOff);
  addText("--------------------------------\n");

  // 2. Invoice Details
  addBytes(left);
  addText(`INV: #${invoice.invoice_number || 'UNKNOWN'}\n`);
  addText(`DATE: ${invoice.invoice_date || 'UNKNOWN'}\n`);
  addText(`SHOP: ${(invoice.customer_shop || '').toUpperCase().slice(0, 24)}\n`);
  addText(`CUST: ${(invoice.customer_name || '').toUpperCase().slice(0, 24)}\n`);
  addText(`ROUTE: ${(invoice.route || 'Local Swat').toUpperCase()}\n`);
  addText(`SALESPERSON: ${(invoice.salesman_name || 'Agent').toUpperCase()}\n`);
  addText(`PAYMENT: ${(invoice.payment_method || 'Cash').toUpperCase()}\n`);
  addText("--------------------------------\n");

  // 3. Grid Row Header
  addBytes(boldOn);
  addText("ITEM          QTY        VALUE\n");
  addBytes(boldOff);
  addText("--------------------------------\n");

  // 4. Products items looping
  if (invoice.items && Array.isArray(invoice.items)) {
    invoice.items.forEach((item: any) => {
      const name = (item.sku_name || `SKU ${item.sku_id}`).slice(0, 12).toUpperCase().padEnd(12);
      const qty = `${item.cases}C/${item.units}U`.padEnd(10);
      const total = `Rs.${(item.line_total || 0).toFixed(0).padStart(6)}`;
      addText(`${name} ${qty} ${total}\n`);
    });
  }
  addText("--------------------------------\n");

  // 5. Calculations Summary Right Aligned
  addBytes(right);
  addText(`SUBTOTAL: Rs.${(invoice.subtotal || 0).toFixed(0)}\n`);
  addText(`SCHEME OFF: -Rs.${(invoice.discount_amount || 0).toFixed(0)}\n`);
  addBytes(boldOn);
  addText(`NET BILL: Rs.${(invoice.total_amount || 0).toFixed(0)}\n`);
  addBytes(boldOff);
  addText(`PREV BAL: Rs.${(invoice.previous_balance || 0).toFixed(0)}\n`);
  addBytes(boldOn);
  const netDue = (invoice.total_amount || 0) + (invoice.previous_balance || 0);
  addText(`NET DUE LEDGER: Rs.${netDue.toFixed(0)}\n`);
  addBytes(boldOff);
  addText("--------------------------------\n");

  // 6. Sign-off message Centered with feed and cut
  addBytes(center);
  addText("\nGenerated Offline via BLE Print Hub\n");
  addBytes(boldOn);
  addText("Thank You for Your Trust!\n\n\n\n\n");
  addBytes(boldOff);
  addBytes(cut);

  return new Uint8Array(buffer);
}

// --- Client-side Styled A4/A5 PDF Builder via jsPDF ---
export function generateInvoicePDF(invoice: any): string {
  // Create jsPDF in portrait Mode
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Theme colors
  const primaryColor = [15, 23, 42]; // Slate-900 (deep professional)
  const secondaryColor = [217, 119, 6]; // Amber-600 (vibrant accent)
  const thinGrey = [226, 232, 240]; // Slate-200 border

  // A4 dimensions: 210 x 297 mm
  // Draw Top Accent Badge
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 6, "F");

  // Corporate Letterhead Heading Left
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("PRIMELINK ENTERPRISES", 14, 18);

  // FMCG Details underneath
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("FMCG DISTRIBUTION DIVISION • SWAT VALLEY HUBS DIRECTORY", 14, 23);
  doc.text("Panr Depot Hub, Mingora SWAT Swat, KPK • Phone: 0310-6548820 / 0312-9856710", 14, 27);
  doc.text("Website: www.primelink.com • Support Routing: panr.hub@primelink.com", 14, 31);

  // Document Title Accent Badge Right Side
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200 border
  doc.roundedRect(125, 12, 71, 24, 3, 3, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]); // Amber-600
  doc.text("SALES TAX INVOICE", 130, 18);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`Serial: ${invoice.invoice_number}`, 130, 24);
  doc.text(`Date Issued: ${invoice.invoice_date}`, 130, 28);
  doc.text(`Ledger Term: ${invoice.payment_method.toUpperCase()}`, 130, 32);

  // Separation Line
  doc.setDrawColor(thinGrey[0], thinGrey[1], thinGrey[2]);
  doc.line(14, 38, 196, 38);

  // Customer & Operations Segment row
  doc.setFillColor(248, 250, 252); // background
  doc.roundedRect(14, 42, 88, 30, 3, 3, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("RETAIL OUTLET DESTINATION", 18, 47);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(invoice.customer_shop || "Outlet General Client", 18, 53);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Contact Representative: ${invoice.customer_name}`, 18, 58);
  doc.text(`Phone: ${invoice.customer_contact || 'None Recorded'}`, 18, 62);
  doc.text(`Compliance State: ${invoice.is_filer ? 'Active Tax Filer' : 'Non-Filer Exempt'}`, 18, 66);

  // Operations metadata box
  doc.setFillColor(248, 250, 252); // background
  doc.roundedRect(108, 42, 88, 30, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("LOGISTICS & DISTRIBUTION", 112, 47);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Target Run Route: ${invoice.route || 'Swat General Route'}`, 112, 53);
  doc.text(`Delivery Executive: ${invoice.salesman_name || 'Counter General Agent'}`, 112, 58);
  doc.text(`Settlement Base: Cash Handover Ledger`, 112, 63);
  doc.text(`FMCG Hub ID: SWAT-PNR-001`, 112, 67);

  // Line items tables
  const tableData: any[] = [];
  if (invoice.items && Array.isArray(invoice.items)) {
    invoice.items.forEach((item, index) => {
      tableData.push([
        index + 1,
        item.sku_name || `SKU ID: ${item.sku_id}`,
        item.cases || 0,
        item.units || 0,
        `Rs. ${(item.trade_price_per_unit || 0).toFixed(1)}`,
        `-${item.discount_percentage}% (Rs. ${(item.discount_amount || 0).toFixed(1)})`,
        `Rs. ${(item.line_total || 0).toLocaleString(undefined, {minimumFractionDigits: 1})}`
      ]);
    });
  }

  // Draw autoTable representation
  autoTable(doc, {
    startY: 78,
    head: [["S.#", "SKU Product Description", "Cases", "Units", "Trade Price / Unit", "Scheme Discount Price", "Net value Ledger"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left"
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 70 },
      2: { halign: "center", cellWidth: 15 },
      3: { halign: "center", cellWidth: 15 },
      4: { halign: "right", cellWidth: 28 },
      5: { halign: "right", cellWidth: 28 },
      6: { halign: "right", cellWidth: 26 }
    },
    styles: {
      fontSize: 8,
      cellPadding: 3
    }
  });

  // Calculate final start Y dynamically
  const tableEndY = (doc as any).lastAutoTable.finalY + 8;
  
  // Total details frame right side
  doc.setDrawColor(241, 245, 249);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(120, tableEndY, 76, 42, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Gross Sub-Total Cash Value:", 123, tableEndY + 7);
  doc.text("Distributor Campaign Scheme:", 123, tableEndY + 13);
  doc.text("Invoice NET Due Value:", 123, tableEndY + 19);
  doc.text("Historic Ledger Balance:", 123, tableEndY + 25);
  doc.text("Consolidated Account Outstanding:", 123, tableEndY + 33);

  // Financial values
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`Rs. ${(invoice.subtotal || 0).toLocaleString()}`, 192, tableEndY + 7, { align: "right" });
  doc.setTextColor(220, 38, 38); // red
  doc.text(`-Rs. ${(invoice.discount_amount || 0).toLocaleString()}`, 192, tableEndY + 13, { align: "right" });
  doc.setTextColor(15, 23, 42);
  doc.text(`Rs. ${(invoice.total_amount || 0).toLocaleString()}`, 192, tableEndY + 19, { align: "right" });
  doc.setTextColor(71, 85, 105);
  doc.text(`Rs. ${(invoice.previous_balance || 0).toLocaleString()}`, 192, tableEndY + 25, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]); // Amber
  const grandTotalLedger = (invoice.total_amount || 0) + (invoice.previous_balance || 0);
  doc.text(`Rs. ${grandTotalLedger.toLocaleString()}`, 192, tableEndY + 33, { align: "right" });

  // Policy & Credit Terms segment left side
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("COMPLIANCE & CREDIT TERMS POLICY", 14, tableEndY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("1. All items supplied are subject to official corporate Swat Hub policies.", 14, tableEndY + 12);
  doc.text("2. Payments must map exact ledger invoices sequentially.", 14, tableEndY + 16);
  doc.text("3. Discrepancies must be registered within 48 hours of transit handover.", 14, tableEndY + 20);
  doc.text("4. Generated locally completely offline under server-link redundancy state.", 14, tableEndY + 24);

  // Signatures at bottom
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.line(14, tableEndY + 45, 65, tableEndY + 45);
  doc.text("Warehouse Handover Officer Signature", 14, tableEndY + 49);

  doc.line(120, tableEndY + 45, 196, tableEndY + 45);
  doc.text("Authorized Distribution Hub Executive Signature", 120, tableEndY + 49);

  // Convert to Blob URL
  const pdfBlob = doc.output("blob");
  return URL.createObjectURL(pdfBlob);
}

// Global hidden iframe utility for print triggering
export function printIframeBlobUrl(blobUrl: string): void {
  // Check if there is an existing iframe, if so remove it
  const existingIFrame = document.getElementById("local-pdf-print-iframe");
  if (existingIFrame) {
    existingIFrame.outerHTML = "";
  }

  const iframe = document.createElement("iframe");
  iframe.id = "local-pdf-print-iframe";
  iframe.style.position = "fixed";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  iframe.src = blobUrl;
  
  document.body.appendChild(iframe);
  
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Direct printing on active Blob IFrame blocked:", err);
        // Fallback: Open in new window
        window.open(blobUrl, "_blank");
      }
    }, 150);
  };
}
