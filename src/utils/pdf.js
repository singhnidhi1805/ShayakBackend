// src/utils/pdf.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const config = require('../config/config');

/**
 * Generate PDF document
 * @param {Object} data - Data to be included in the PDF
 * @param {string} type - Type of PDF to generate (invoice, receipt, etc.)
 * @returns {Promise<Buffer>} PDF as buffer
 */
exports.generatePdf = async (data, type = 'invoice') => {
  return new Promise((resolve, reject) => {
    try {
      // Create a new PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `${type === 'invoice' ? 'Invoice' : 'Receipt'} ${data.invoiceNumber || ''}`,
          Author: config.appName || 'Service Platform',
          Subject: `${type === 'invoice' ? 'Invoice' : 'Receipt'} for services rendered`,
          Keywords: 'invoice, payment, service',
          CreationDate: new Date(),
        }
      });

      // Create a buffer to store the PDF
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Load logo if exists
      const logoPath = path.join(__dirname, '../assets/logo.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 150 });
      } else {
        // If no logo, just write the app name
        doc.fontSize(20).font('Helvetica-Bold').text(config.appName || 'Service Platform', 50, 45);
      }

      // Choose the right template based on type
      if (type === 'invoice') {
        generateInvoiceTemplate(doc, data);
      } else if (type === 'receipt') {
        generateReceiptTemplate(doc, data);
      } else {
        // Default to invoice
        generateInvoiceTemplate(doc, data);
      }

      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate invoice template
 * @param {PDFDocument} doc - PDFDocument instance
 * @param {Object} data - Invoice data
 */
function generateInvoiceTemplate(doc, data) {
  // Set initial position
  let y = 45;

  // Add title
  doc.fontSize(20).font('Helvetica-Bold').text('INVOICE', 400, y);
  y += 40;

  // Add invoice details
  doc.fontSize(10).font('Helvetica');
  doc.text(`Invoice Number: ${data.invoiceNumber}`, 400, y);
  y += 15;
  doc.text(`Invoice Date: ${moment(data.invoiceDate).format('DD/MM/YYYY')}`, 400, y);
  y += 15;
  doc.text(`Due Date: ${moment(data.dueDate).format('DD/MM/YYYY')}`, 400, y);
  y += 40;

  // Add professional info
  doc.fontSize(12).font('Helvetica-Bold').text('From:', 50, y);
  y += 20;
  doc.fontSize(10).font('Helvetica');
  doc.text(`${data.professionalInfo.name}`, 50, y);
  y += 15;
  if (data.professionalInfo.address) {
    doc.text(`${data.professionalInfo.address}`, 50, y);
    y += 15;
  }
  if (data.professionalInfo.city || data.professionalInfo.state || data.professionalInfo.pincode) {
    let location = '';
    if (data.professionalInfo.city) location += data.professionalInfo.city;
    if (data.professionalInfo.state) {
      if (location) location += ', ';
      location += data.professionalInfo.state;
    }
    if (data.professionalInfo.pincode) {
      if (location) location += ' - ';
      location += data.professionalInfo.pincode;
    }
    doc.text(location, 50, y);
    y += 15;
  }
  doc.text(`Phone: ${data.professionalInfo.phone || 'N/A'}`, 50, y);
  y += 15;
  doc.text(`Email: ${data.professionalInfo.email || 'N/A'}`, 50, y);
  y += 15;
  doc.text(`Professional ID: ${data.professionalInfo.id || 'N/A'}`, 50, y);
  y += 30;

  // Add customer info
  doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 400, y - 95);
  y -= 75;
  doc.fontSize(10).font('Helvetica');
  doc.text(`${data.customerInfo.name || 'Customer'}`, 400, y);
  y += 15;
  if (data.customerInfo.phone) {
    doc.text(`Phone: ${data.customerInfo.phone}`, 400, y);
    y += 15;
  }
  if (data.customerInfo.email) {
    doc.text(`Email: ${data.customerInfo.email}`, 400, y);
    y += 15;
  }
  y += 30;

  // Add booking info
  doc.fontSize(12).font('Helvetica-Bold').text('Service Details:', 50, y);
  y += 20;
  doc.fontSize(10).font('Helvetica');
  doc.text(`Service Date: ${moment(data.bookingInfo.date).format('DD/MM/YYYY')}`, 50, y);
  y += 15;
  doc.text(`Booking ID: ${data.bookingInfo.id}`, 50, y);
  y += 15;
  doc.text(`Service: ${data.bookingInfo.service}`, 50, y);
  y += 15;
  
  // Add items table
  y += 30;
  const tableTop = y;
  doc.font('Helvetica-Bold');
  doc.text('Item', 50, y);
  doc.text('Quantity', 250, y);
  doc.text('Unit Price', 350, y);
  doc.text('Amount', 450, y);
  y += 20;

  // Add line
  doc.moveTo(50, y - 5).lineTo(550, y - 5).stroke();
  
  // Add items
  doc.font('Helvetica');
  data.items.forEach(item => {
    doc.text(item.description, 50, y);
    doc.text(item.quantity.toString(), 250, y);
    doc.text(`₹${item.unitPrice.toFixed(2)}`, 350, y);
    doc.text(`₹${item.amount.toFixed(2)}`, 450, y);
    y += 20;
  });

  // Add line
  doc.moveTo(50, y - 5).lineTo(550, y - 5).stroke();

  // Add totals
  y += 10;
  doc.text('Subtotal:', 350, y);
  doc.text(`₹${data.subtotal.toFixed(2)}`, 450, y);
  y += 20;

  if (data.tax > 0) {
    doc.text(`Tax (${((data.tax / data.subtotal) * 100).toFixed(2)}%):`, 350, y);
    doc.text(`₹${data.tax.toFixed(2)}`, 450, y);
    y += 20;
  }

  doc.font('Helvetica-Bold');
  doc.text('Total:', 350, y);
  doc.text(`₹${data.total.toFixed(2)}`, 450, y);
  
  // Add notes
  if (data.notes) {
    y += 50;
    doc.font('Helvetica-Bold').text('Notes:', 50, y);
    y += 15;
    doc.font('Helvetica').text(data.notes, 50, y, { width: 500 });
  }

  // Add footer
  const footerTop = 750;
  doc.fontSize(8).font('Helvetica').text(
    'This is a computer-generated invoice and does not require a physical signature.',
    50, footerTop, { align: 'center', width: 500 }
  );
  doc.fontSize(8).text(
    `Generated on ${moment().format('DD/MM/YYYY HH:mm:ss')}`,
    50, footerTop + 15, { align: 'center', width: 500 }
  );
}

/**
 * Generate receipt template
 * @param {PDFDocument} doc - PDFDocument instance
 * @param {Object} data - Receipt data
 */
function generateReceiptTemplate(doc, data) {
  // Set initial position
  let y = 45;

  // Add title
  doc.fontSize(20).font('Helvetica-Bold').text('PAYMENT RECEIPT', 350, y);
  y += 40;

  // Add receipt details
  doc.fontSize(10).font('Helvetica');
  doc.text(`Receipt Number: ${data.receiptNumber || data.invoiceNumber}`, 350, y);
  y += 15;
  doc.text(`Date: ${moment(data.receiptDate || data.invoiceDate).format('DD/MM/YYYY')}`, 350, y);
  y += 40;

  // Add professional info
  doc.fontSize(12).font('Helvetica-Bold').text('From:', 50, y);
  y += 20;
  doc.fontSize(10).font('Helvetica');
  doc.text(`${data.professionalInfo.name}`, 50, y);
  y += 15;
  if (data.professionalInfo.address) {
    doc.text(`${data.professionalInfo.address}`, 50, y);
    y += 15;
  }
  if (data.professionalInfo.city || data.professionalInfo.state || data.professionalInfo.pincode) {
    let location = '';
    if (data.professionalInfo.city) location += data.professionalInfo.city;
    if (data.professionalInfo.state) {
      if (location) location += ', ';
      location += data.professionalInfo.state;
    }
    if (data.professionalInfo.pincode) {
      if (location) location += ' - ';
      location += data.professionalInfo.pincode;
    }
    doc.text(location, 50, y);
    y += 15;
  }
  doc.text(`Phone: ${data.professionalInfo.phone || 'N/A'}`, 50, y);
  y += 15;
  doc.text(`Email: ${data.professionalInfo.email || 'N/A'}`, 50, y);
  y += 30;

  // Add customer info
  doc.fontSize(12).font('Helvetica-Bold').text('Payment From:', 350, y - 95);
  y -= 75;
  doc.fontSize(10).font('Helvetica');
  doc.text(`${data.customerInfo.name || 'Customer'}`, 350, y);
  y += 15;
  if (data.customerInfo.phone) {
    doc.text(`Phone: ${data.customerInfo.phone}`, 350, y);
    y += 15;
  }
  if (data.customerInfo.email) {
    doc.text(`Email: ${data.customerInfo.email}`, 350, y);
    y += 15;
  }
  y += 30;

  // Add payment details
  doc.fontSize(12).font('Helvetica-Bold').text('Payment Details:', 50, y);
  y += 20;
  doc.fontSize(10).font('Helvetica');
  doc.text(`Invoice Number: ${data.invoiceNumber || 'N/A'}`, 50, y);
  y += 15;
  doc.text(`Payment Date: ${moment(data.paymentDate || data.invoiceDate).format('DD/MM/YYYY')}`, 50, y);
  y += 15;
  if (data.paymentMethod) {
    doc.text(`Payment Method: ${data.paymentMethod}`, 50, y);
    y += 15;
  }
  if (data.transactionId) {
    doc.text(`Transaction ID: ${data.transactionId}`, 50, y);
    y += 15;
  }
  if (data.bookingInfo && data.bookingInfo.service) {
    doc.text(`Service: ${data.bookingInfo.service}`, 50, y);
    y += 15;
  }
  
  // Add amount details
  y += 30;
  doc.fontSize(12).font('Helvetica-Bold').text('Amount Details:', 50, y);
  y += 20;
  doc.fontSize(10).font('Helvetica');
  
  // Add line
  doc.moveTo(50, y - 5).lineTo(550, y - 5).stroke();
  
  // Add totals
  doc.text('Total Amount Paid:', 350, y);
  doc.font('Helvetica-Bold').text(`₹${data.total.toFixed(2)}`, 450, y);
  y += 20;

  // Add line
  doc.moveTo(50, y - 5).lineTo(550, y - 5).stroke();
  
  // Add notes
  if (data.notes) {
    y += 50;
    doc.font('Helvetica-Bold').text('Notes:', 50, y);
    y += 15;
    doc.font('Helvetica').text(data.notes, 50, y, { width: 500 });
  }

  // Add "thank you" message
  y += 50;
  doc.font('Helvetica-Bold').text('Thank you for your business!', 50, y, { align: 'center', width: 500 });

  // Add footer
  const footerTop = 750;
  doc.fontSize(8).font('Helvetica').text(
    'This is a computer-generated receipt and does not require a physical signature.',
    50, footerTop, { align: 'center', width: 500 }
  );
  doc.fontSize(8).text(
    `Generated on ${moment().format('DD/MM/YYYY HH:mm:ss')}`,
    50, footerTop + 15, { align: 'center', width: 500 }
  );
}

/**
 * Generate PDF and save to file
 * @param {Object} data - Data to be included in the PDF
 * @param {string} type - Type of PDF to generate (invoice, receipt, etc.)
 * @param {string} outputPath - Path to save the PDF
 * @returns {Promise<string>} Path to saved PDF
 */
exports.generateAndSavePdf = async (data, type = 'invoice', outputPath) => {
  try {
    const pdfBuffer = await exports.generatePdf(data, type);
    
    // If no output path is provided, generate one
    if (!outputPath) {
      const fileName = `${type}_${data.invoiceNumber || moment().format('YYYYMMDDHHmmss')}.pdf`;
      outputPath = path.join(__dirname, `../temp/${fileName}`);
      
      // Ensure the temp directory exists
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    }
    
    // Write the PDF to file
    fs.writeFileSync(outputPath, pdfBuffer);
    
    return outputPath;
  } catch (error) {
    console.error(`Error generating and saving PDF: ${error.message}`);
    throw error;
  }
};