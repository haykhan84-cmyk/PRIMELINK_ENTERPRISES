
export const triggerPrint = () => {
  // Check if in iframe
  const isInIframe = window.self !== window.top;
  
  if (isInIframe) {
    const confirmMessage = "Printing from inside the preview iframe may not work correctly or may be blocked by your browser. \n\nFor the best professional printing experience, please click the 'Open in New Tab' button in the top right of AI Studio, then try printing again.\n\nWould you like to try printing anyway?";
    if (window.confirm(confirmMessage)) {
      window.print();
    }
  } else {
    window.print();
  }
};

export const downloadPDF = (elementId: string, filename: string) => {
  alert("PDF Export library (jspdf) is not installed. Browser Print is the recommended method for Primelink ERP Professional Invoices.");
};
