import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import "regenerator-runtime/runtime";
import fontkit from "@pdf-lib/fontkit";

export type ReceiptInvoice = {
  invoice_number: string; invoice_date: string; customer_name: string; customer_phone: string | null;
  customer_address: string | null; customer_gstin: string | null; payment_status: string;
  shop_name: string | null; shop_address: string | null; shop_phone: string | null; shop_email: string | null;
  shop_gstin: string | null; invoice_footer: string | null; invoice_terms: string | null;
  subtotal: number | string; discount_total: number | string; cgst_total: number | string;
  sgst_total: number | string; igst_total: number | string; grand_total: number | string;
  amount_paid: number | string; balance_due: number | string;
};
export type ReceiptItem = {
  product_name: string; sku: string; quantity: number | string; unit_name: string;
  unit_price: number | string; discount_amount: number | string; invoice_discount_allocated: number | string;
  taxable_amount: number | string; gst_rate: number | string; cgst_amount: number | string;
  sgst_amount: number | string; igst_amount: number | string; line_total: number | string;
};

type Fonts = { latin: PDFFont; devanagari: PDFFont };
const ink = rgb(0.08, 0.1, 0.14);
const muted = rgb(0.35, 0.39, 0.45);
const rule = rgb(0.75, 0.78, 0.82);
const amount = (value: number | string) => `INR ${Number(value).toFixed(2)}`;
const isDevanagari = (char: string) => /[\u0900-\u097f]/u.test(char);

function runs(text: string, fonts: Fonts) {
  const result: { text: string; font: PDFFont }[] = [];
  for (const char of text) {
    const font = isDevanagari(char) ? fonts.devanagari : fonts.latin;
    const last = result[result.length - 1];
    if (last?.font === font) last.text += char;
    else result.push({ text: char, font });
  }
  return result;
}

function measure(text: string, size: number, fonts: Fonts) {
  return runs(text, fonts).reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, size), 0);
}

function drawText(page: PDFPage, text: string, x: number, y: number, size: number, fonts: Fonts, color = ink) {
  let cursor = x;
  for (const run of runs(text, fonts)) {
    page.drawText(run.text, { x: cursor, y, size, font: run.font, color });
    cursor += run.font.widthOfTextAtSize(run.text, size);
  }
  return cursor;
}

function wrap(text: string, maxWidth: number, size: number, fonts: Fonts, maxLines = 3) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, size, fonts) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    let final = lines[maxLines - 1] ?? "";
    while (final && measure(`${final}...`, size, fonts) > maxWidth) final = final.slice(0, -1);
    lines[maxLines - 1] = `${final}...`;
  }
  return lines;
}

function rightText(page: PDFPage, text: string, right: number, y: number, size: number, fonts: Fonts, color = ink) {
  drawText(page, text, right - measure(text, size, fonts), y, size, fonts, color);
}

export async function createReceiptPdf(invoice: ReceiptInvoice, items: ReceiptItem[], fontBytes: { latin: Uint8Array; devanagari: Uint8Array }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts: Fonts = {
    latin: await pdf.embedFont(fontBytes.latin, { subset: true }),
    devanagari: await pdf.embedFont(fontBytes.devanagari, { subset: true }),
  };
  const width = 226.77;
  const margin = 14;
  const content = width - margin * 2;
  const pageHeight = Math.max(340, 260 + items.length * 52);
  const page = pdf.addPage([width, pageHeight]);
  let y = pageHeight - margin - 10;
  const lineHeight = (size = 9) => size + 3;
  const drawCenter = (text: string, size: number) => {
    drawText(page, text, Math.max(margin, (width - measure(text, size, fonts)) / 2), y, size, fonts);
  };
  const shopName = invoice.shop_name || "Wholesale Shop";
  for (const titleLine of wrap(shopName, content, 12, fonts, 2)) { drawCenter(titleLine, 12); y -= lineHeight(12); }
  for (const addressLine of wrap(invoice.shop_address ?? "", content, 8, fonts, 3)) { drawCenter(addressLine, 8); y -= lineHeight(8); }
  const shopContact = [invoice.shop_phone, invoice.shop_email].filter(Boolean).join(" · ");
  if (shopContact) { drawCenter(shopContact, 7.5); y -= lineHeight(7.5); }
  if (invoice.shop_gstin) { drawCenter(`GSTIN: ${invoice.shop_gstin}`, 8); y -= lineHeight(8); }
  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.7, color: rule });
  y -= 13;
  drawText(page, `Invoice ${invoice.invoice_number}`, margin, y, 8.5, fonts);
  y -= lineHeight();
  drawText(page, new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(invoice.invoice_date)), margin, y, 7.5, fonts, muted);
  y -= lineHeight();
  for (const customerLine of wrap(`Customer: ${invoice.customer_name}`, content, 8, fonts, 2)) { drawText(page, customerLine, margin, y, 8, fonts); y -= lineHeight(8); }
  if (invoice.customer_phone) { drawText(page, `Phone: ${invoice.customer_phone}`, margin, y, 7.5, fonts, muted); y -= lineHeight(7.5); }
  if (invoice.customer_gstin) { drawText(page, `GSTIN: ${invoice.customer_gstin}`, margin, y, 7.5, fonts, muted); y -= lineHeight(7.5); }
  if (invoice.customer_address) for (const customerLine of wrap(invoice.customer_address, content, 7.5, fonts, 3)) { drawText(page, customerLine, margin, y, 7.5, fonts, muted); y -= lineHeight(7.5); }
  y -= 3;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.7, color: rule });
  y -= 13;
  for (const item of items) {
    const nameLines = wrap(item.product_name, content, 8.5, fonts, 2);
    for (const name of nameLines) { drawText(page, name, margin, y, 8.5, fonts); y -= lineHeight(8.5); }
    const priceLine = `${Number(item.quantity)} ${item.unit_name} x ${amount(item.unit_price)}`;
    drawText(page, priceLine, margin, y, 7, fonts, muted);
    rightText(page, amount(item.line_total), width - margin, y, 7.5, fonts);
    y -= lineHeight(7);
    const discounts = Number(item.discount_amount) + Number(item.invoice_discount_allocated);
    if (discounts > 0) { drawText(page, `Discount ${amount(discounts)} · Taxable ${amount(item.taxable_amount)}`, margin, y, 7, fonts, muted); y -= lineHeight(7); }
    const tax = Number(item.cgst_amount) + Number(item.sgst_amount) + Number(item.igst_amount);
    drawText(page, `GST ${Number(item.gst_rate)}% · tax ${amount(tax)}`, margin, y, 7, fonts, muted);
    y -= lineHeight(7) + 3;
  }
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.7, color: rule });
  y -= 13;
  const totalRow = (label: string, value: number | string, bold = false) => {
    const size = bold ? 9 : 7.7;
    drawText(page, label, margin, y, size, fonts, bold ? ink : muted);
    rightText(page, amount(value), width - margin, y, size, fonts, ink);
    y -= lineHeight(size) + (bold ? 2 : 0);
  };
  totalRow("Subtotal", invoice.subtotal);
  totalRow("Discount", invoice.discount_total);
  totalRow("CGST", invoice.cgst_total);
  totalRow("SGST", invoice.sgst_total);
  totalRow("IGST", invoice.igst_total);
  totalRow("Grand total", invoice.grand_total, true);
  totalRow(`Paid (${invoice.payment_status.replaceAll("_", " ")})`, invoice.amount_paid);
  totalRow("Balance due", invoice.balance_due, true);
  y -= 3;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.7, color: rule });
  y -= 13;
  for (const footerLine of wrap(invoice.invoice_footer ?? "", content, 7, fonts, 2)) { drawText(page, footerLine, margin, y, 7, fonts, muted); y -= lineHeight(7); }
  for (const termsLine of wrap(invoice.invoice_terms ?? "", content, 7, fonts, 3)) { drawText(page, termsLine, margin, y, 7, fonts, muted); y -= lineHeight(7); }
  drawText(page, "Thank you for your business.", margin, y - 4, 7, fonts, muted);
  return pdf.save();
}
