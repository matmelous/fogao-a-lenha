import type { Order, RestaurantSettings } from './types';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const buildPrintableOrderHtml = (
  order: Order,
  settings: RestaurantSettings,
  tenantDisplayName: string,
) => {
  const printableOrder = order as Order & {
    observation?: string;
    observations?: string;
  };

  const paperWidthMm = settings.printing?.paperWidthMm === 58 ? 58 : 80;
  const ticketWidthMm = paperWidthMm === 58 ? 46 : 68;
  const subtotal = Math.max(order.total - settings.deliveryFee, 0);
  const createdAtLabel = new Date(order.createdAt).toLocaleString('pt-BR');
  const orderNotes = printableOrder.notes || printableOrder.observation || printableOrder.observations || '';
  const deliveryReference = order.reference || '';
  const changeForLabel = typeof order.changeFor === 'number'
    ? formatCurrency(order.changeFor)
    : '';

  const itemsHtml = order.items.map((entry) => `
      <div class="item-row item-card">
        <div class="item-main">
          <span class="qty">${entry.quantity}x</span>
          <span class="name">${escapeHtml(entry.item.name)}</span>
        </div>
        <span class="value">${formatCurrency(entry.item.price * entry.quantity)}</span>
      </div>
    `).join('');

  const paymentStatusLabel = order.paymentStatus ? escapeHtml(order.paymentStatus) : '';
  const copySections = [
    {
      title: 'Cozinha',
      note: 'Via de producao. Priorize os itens e a sequencia do preparo.',
      showItems: true,
      showPayment: true,
      showAddress: false,
      showTotals: false,
      highlightItems: true,
      showNotes: true,
      showCheckmarks: false,
    },
    {
      title: 'Caixa',
      note: 'Via financeira. Conferir pagamento, total e fechamento do pedido.',
      showItems: true,
      showPayment: true,
      showAddress: false,
      showTotals: true,
      highlightItems: false,
      showNotes: true,
      showCheckmarks: true,
    },
    {
      title: 'Motoboy',
      note: 'Via de entrega. Usar para rota e confirmacao com o cliente.',
      showItems: false,
      showPayment: true,
      showAddress: true,
      showTotals: false,
      highlightItems: false,
      showNotes: true,
      showCheckmarks: true,
    },
    {
      title: 'Cliente',
      note: 'Comprovante do pedido entregue ao cliente.',
      showItems: true,
      showPayment: true,
      showAddress: true,
      showTotals: true,
      highlightItems: false,
      showNotes: true,
      showCheckmarks: false,
    },
  ];

  const renderCopy = (copy: (typeof copySections)[number]) => `
      <section class="ticket copy">
        <div class="copy-badge">${escapeHtml(copy.title)}</div>
        <div class="title">${escapeHtml(settings.name || tenantDisplayName)}</div>
        <div class="subtitle">Pedido #${escapeHtml(order.id)}<br />${escapeHtml(createdAtLabel)}</div>

        <section class="section">
          <div class="section-title">Cliente</div>
          <div class="meta-line"><span class="label">Nome:</span> ${escapeHtml(order.customerName)}</div>
          <div class="meta-line"><span class="label">Telefone:</span> ${escapeHtml(order.customerPhone)}</div>
          ${order.customerEmail ? `<div><span class="label">E-mail:</span> ${escapeHtml(order.customerEmail)}</div>` : ''}
          ${copy.showAddress ? `<div class="address-box"><div class="label">Endereco</div><div>${escapeHtml(order.address)}</div>${deliveryReference ? `<div><span class="label">Referencia:</span> ${escapeHtml(deliveryReference)}</div>` : ''}</div>` : ''}
        </section>

        ${copy.showItems ? `
          <section class="section ${copy.highlightItems ? 'items-kitchen' : ''}">
            <div class="section-title">Itens</div>
            ${itemsHtml || '<div>Nenhum item informado.</div>'}
          </section>
        ` : ''}

        ${copy.showNotes ? `
          <section class="section">
            <div class="section-title">Observacoes</div>
            <div class="notes-box">${orderNotes ? escapeHtml(orderNotes) : 'Sem observacoes informadas.'}</div>
          </section>
        ` : ''}

        ${copy.showPayment ? `
          <section class="section">
            <div class="section-title">Pagamento</div>
            <div class="meta-row"><span class="label">Metodo</span><span>${escapeHtml(order.paymentMethod)}</span></div>
            ${paymentStatusLabel ? `<div class="meta-row"><span class="label">Status</span><span>${paymentStatusLabel}</span></div>` : ''}
            ${changeForLabel ? `<div class="meta-row"><span class="label">Troco para</span><span>${changeForLabel}</span></div>` : ''}
          </section>
        ` : ''}

        ${copy.showTotals ? `
          <section class="totals">
            <div class="total-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
            <div class="total-row"><span>Entrega</span><span>${formatCurrency(settings.deliveryFee)}</span></div>
            <div class="total-row total-value"><span>Total</span><span>${formatCurrency(order.total)}</span></div>
          </section>
        ` : ''}

        ${copy.showCheckmarks ? `
          <section class="section">
            <div class="section-title">Conferencia</div>
            <div class="check-row"><span class="check-box"></span><span>Pedido conferido</span></div>
            <div class="check-row"><span class="check-box"></span><span>${copy.title === 'Caixa' ? 'Pagamento confirmado' : 'Entrega concluida'}</span></div>
          </section>
        ` : ''}

        <div class="footer">${escapeHtml(copy.note)}</div>
      </section>
    `;

  const allCopiesHtml = copySections.map(renderCopy).join('<div class="cut-line">Corte aqui</div>');

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Pedido #${escapeHtml(order.id)}</title>
    <style>
      @page { size: ${paperWidthMm}mm auto; margin: 4mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111827;
        font-family: Arial, sans-serif;
        font-size: 12px;
        line-height: 1.4;
      }
      .sheet { width: ${ticketWidthMm}mm; margin: 0 auto; }
      .ticket { width: ${ticketWidthMm}mm; margin: 0 auto; }
      .copy { padding-bottom: 10px; }
      .copy + .copy { margin-top: 10px; }
      .copy-badge {
        border: 1px solid #111827;
        padding: 4px 8px;
        text-align: center;
        text-transform: uppercase;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .title, .section-title, .total-value { font-weight: 700; }
      .title { font-size: 18px; text-align: center; margin-bottom: 4px; }
      .subtitle { text-align: center; margin-bottom: 14px; }
      .section { border-top: 1px dashed #9ca3af; padding-top: 10px; margin-top: 10px; }
      .section-title { text-transform: uppercase; font-size: 11px; margin-bottom: 6px; }
      .meta-line + .meta-line { margin-top: 4px; }
      .meta-row, .item-row, .total-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: flex-start;
      }
      .meta-row + .meta-row, .item-row + .item-row, .total-row + .total-row { margin-top: 6px; }
      .label { font-weight: 700; }
      .item-main { display: flex; gap: 6px; }
      .qty { font-weight: 700; }
      .name { word-break: break-word; }
      .item-card {
        border: 1px dashed #d1d5db;
        padding: 6px 8px;
        border-radius: 6px;
      }
      .items-kitchen .item-card {
        border: 1px solid #111827;
        padding: 8px;
      }
      .items-kitchen .qty {
        font-size: 15px;
      }
      .items-kitchen .name {
        font-size: 14px;
        font-weight: 700;
      }
      .address-box, .notes-box {
        border: 1px dashed #9ca3af;
        padding: 8px;
        border-radius: 6px;
      }
      .address-box div + div, .notes-box div + div { margin-top: 4px; }
      .check-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .check-row + .check-row { margin-top: 6px; }
      .check-box {
        width: 14px;
        height: 14px;
        border: 1px solid #111827;
        display: inline-block;
      }
      .totals { border-top: 1px dashed #9ca3af; padding-top: 8px; margin-top: 10px; }
      .total-value { font-size: 16px; }
      .footer {
        border-top: 1px dashed #9ca3af;
        margin-top: 12px;
        padding-top: 10px;
        text-align: center;
        font-size: 11px;
      }
      .cut-line {
        width: ${ticketWidthMm}mm;
        margin: 10px auto;
        padding-top: 6px;
        border-top: 1px dashed #6b7280;
        text-align: center;
        font-size: 10px;
        text-transform: uppercase;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <main class="sheet">${allCopiesHtml}</main>
  </body>
</html>`;
};
