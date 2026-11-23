// Editorial stylesheet. Copied unchanged from report-pdf-editorial.ts.

export const editorialCss = `
  @page {
    size: Letter;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: #1f262d;
    background: #f3eee4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1, h2, h3 {
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 700;
    color: #1a2128;
    margin: 0;
  }

  h1 { font-size: 28px; line-height: 1.08; }
  h2 { font-size: 20px; line-height: 1.2; }
  h3 { font-size: 15px; line-height: 1.25; }
  p {
    margin: 0;
    color: #33404b;
    font-size: 12.1px;
    line-height: 1.48;
  }

  .page {
    width: 8.5in;
    height: 11in;
    page-break-after: always;
    padding: 0.58in 0.62in 0.46in 0.62in;
    background: #f8f4eb;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: hidden;
  }

  .page:last-child {
    page-break-after: auto;
  }

  .page-header,
  .page-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .page-header {
    border-bottom: 1px solid #d2c8b6;
    padding-bottom: 10px;
    margin-bottom: 18px;
  }

  .page-header__brand {
    display: grid;
    gap: 4px;
  }

  .page-header__wordmark {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #7e6337;
  }

  .page-header__meta,
  .page-header__date,
  .page-header__ticker,
  .page-footer {
    font-size: 10px;
    color: #6a706f;
  }

  .page-body {
    display: grid;
    gap: 16px;
    flex: 1 1 auto;
    min-height: 0;
    align-content: start;
  }

  .page-footer {
    border-top: 1px solid #d2c8b6;
    padding-top: 9px;
    margin-top: auto;
  }

  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #7e6337;
    font-weight: 700;
  }

  .hero {
    display: grid;
    grid-template-columns: 1.8fr 0.8fr;
    gap: 18px;
    align-items: start;
  }

  .hero__copy {
    display: grid;
    gap: 10px;
  }

  .hero__subtitle {
    font-size: 14px;
    color: #55616c;
    line-height: 1.45;
  }

  .hero__signal {
    background: #213141;
    color: #f4efe4;
    border-radius: 18px;
    padding: 16px;
    display: grid;
    gap: 8px;
    text-align: right;
  }

  .price-chip {
    justify-self: end;
    background: rgba(216, 194, 153, 0.18);
    border: 1px solid rgba(216, 194, 153, 0.34);
    color: #f2e7d2;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hero__spot {
    font-size: 28px;
    font-family: Georgia, "Times New Roman", serif;
  }

  .hero__upside {
    font-size: 11px;
    color: #d8d0bf;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .chip {
    padding: 10px 12px;
    border-radius: 14px;
    display: flex;
    gap: 10px;
    align-items: baseline;
    border: 1px solid #d9d0c1;
    background: #fffdf8;
    font-size: 11px;
  }

  .chip strong {
    font-size: 12px;
    color: #1f262d;
  }

  .chip.positive {
    border-color: rgba(48, 96, 74, 0.2);
    background: #eaf2ee;
  }

  .chip.warning {
    border-color: rgba(179, 135, 79, 0.28);
    background: #f3ead8;
  }

  .chip.gold {
    border-color: rgba(192, 160, 96, 0.28);
    background: #f6efe0;
  }

  .thesis-box,
  .decision-box,
  .section-panel,
  .editorial-card,
  .side-card,
  .mini-card,
  .risk-card,
  .appendix-item {
    background: #fffdf8;
    border: 1px solid #ded5c6;
    border-radius: 18px;
  }

  .thesis-box,
  .section-panel {
    padding: 18px;
  }

  .thesis-box {
    display: grid;
    gap: 10px;
  }

  .decision-box {
    padding: 16px 18px;
    background: #f1ebdf;
    border-color: #d7c7a8;
    display: grid;
    gap: 8px;
  }

  .decision-box__label {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #7e6337;
    font-weight: 700;
  }

  .decision-box__question {
    font-size: 17px;
    line-height: 1.35;
    color: #27323b;
    font-family: Georgia, "Times New Roman", serif;
  }

  .three-up,
  .two-up,
  .mini-grid,
  .appendix-grid {
    display: grid;
    gap: 14px;
  }

  .three-up {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .two-up {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mini-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .appendix-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .editorial-card,
  .risk-card,
  .appendix-item {
    padding: 14px;
    display: grid;
    gap: 8px;
  }

  .editorial-card__title,
  .side-card__label,
  .section-panel__kicker,
  .risk-card__label,
  .appendix-item__meta {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
    color: #7e6337;
  }

  .summary-pill {
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 11px;
    line-height: 1.35;
    border: 1px solid #d7c7a8;
    background: #f6efe0;
    color: #4a5660;
  }

  .summary-pill.positive {
    background: #eaf2ee;
    border-color: rgba(48, 96, 74, 0.2);
  }

  .summary-pill.warning {
    background: #f3ead8;
    border-color: rgba(179, 135, 79, 0.28);
  }

  .summary-pill.neutral {
    background: #f5f1e8;
    border-color: #ded5c6;
  }

  .summary-pill.gold {
    background: #f6efe0;
    border-color: rgba(192, 160, 96, 0.28);
  }

  .narrative-header,
  .section-panel__header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: start;
  }

  .narrative-columns {
    display: grid;
    grid-template-columns: 1.8fr 0.9fr;
    gap: 16px;
  }

  .narrative-columns__main,
  .narrative-columns__side {
    display: grid;
    gap: 12px;
  }

  .side-card {
    padding: 14px;
    display: grid;
    gap: 8px;
  }

  .mini-card {
    padding: 12px;
    font-size: 11.4px;
    line-height: 1.45;
    color: #32404c;
  }

  .meta-strip {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    font-size: 10px;
    color: #6a706f;
  }

  .coverage-note,
  .appendix-note {
    padding: 12px 14px;
    border-radius: 16px;
    background: #f2ede3;
    border: 1px solid #ddd3c2;
    font-size: 11px;
    color: #5a6670;
    line-height: 1.45;
  }

  .financial-table,
  .scenario-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  .financial-table th,
  .financial-table td,
  .scenario-table th,
  .scenario-table td {
    padding: 10px 8px;
    text-align: left;
    border-bottom: 1px solid #e8e0d2;
  }

  .financial-table thead th,
  .scenario-table thead th {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6a706f;
  }

  .evidence-list {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 8px;
    color: #32404c;
    font-size: 11.5px;
    line-height: 1.45;
  }

  .chart-svg,
  .range-svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .chart-title {
    font-size: 12px;
    font-family: Georgia, "Times New Roman", serif;
    fill: #223042;
  }

  .chart-svg text,
  .range-svg text {
    font-size: 10px;
    fill: #5a6670;
    font-family: "Helvetica Neue", Arial, sans-serif;
  }

  .range-label {
    font-size: 9px;
  }

  .filing-hero,
  .value-hero {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: start;
    padding: 18px 20px;
    border-radius: 20px;
    background: #1d2935;
    color: #f6efe0;
  }

  .filing-hero h1 {
    color: #f8f1e4;
  }

  .value-hero {
    background: linear-gradient(135deg, #1d2935 0%, #263d43 100%);
  }

  .value-hero h1 {
    color: #f8f1e4;
  }

  .filing-hero__meta,
  .value-hero__meta {
    margin-top: 8px;
    color: #d8d0bf;
  }

  .filing-hero__badge,
  .value-hero__badge {
    padding: 8px 11px;
    border-radius: 999px;
    background: rgba(192, 160, 96, 0.18);
    border: 1px solid rgba(192, 160, 96, 0.34);
    color: #f2dfb3;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .filing-story {
    padding: 18px 20px;
    border-radius: 20px;
    background: #fffdf8;
    border: 1px solid #e2d8c6;
    display: grid;
    gap: 11px;
  }

  .filing-story p {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12.7px;
    line-height: 1.58;
    color: #26323d;
  }

  .filing-story--compact p {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 11.8px;
    line-height: 1.5;
  }

  .filing-callout {
    border-left: 5px solid #c0a060;
    padding: 14px 16px;
    border-radius: 14px;
    background: #f7eedc;
    display: grid;
    gap: 7px;
  }

  .filing-callout__label,
  .filing-metric-card__label,
  .filing-metric-card__basis,
  .indicator-card__label,
  .price-provenance__label,
  .education-card__topic {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
    color: #7e6337;
  }

  .filing-change-grid,
  .filing-metric-grid,
  .indicator-grid,
  .education-grid {
    display: grid;
    gap: 10px;
  }

  .filing-change-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filing-change-card {
    border: 1px solid #e1d7c7;
    background: #fffdf8;
    border-radius: 16px;
    padding: 12px;
    display: grid;
    grid-template-columns: 9px 1fr;
    gap: 9px;
    align-items: start;
  }

  .filing-change-card span {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: #c0a060;
    margin-top: 5px;
  }

  .filing-metric-grid,
  .indicator-grid,
  .education-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .price-provenance {
    border: 1px solid #d7c7a8;
    background: #f6efe0;
    border-radius: 16px;
    padding: 13px 15px;
    display: grid;
    grid-template-columns: 1fr 2.2fr;
    gap: 14px;
    align-items: start;
    break-inside: avoid;
  }

  .price-provenance strong {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 20px;
    color: #1d2935;
  }

  .price-provenance p {
    margin: 0;
    font-size: 10px;
    line-height: 1.45;
    color: #56616a;
  }

  .filing-metric-card,
  .indicator-card {
    border-radius: 16px;
    padding: 12px;
    border: 1px solid #ded5c6;
    background: #fffdf8;
    display: grid;
    gap: 9px;
    break-inside: avoid;
  }

  .filing-metric-card.positive {
    border-color: rgba(47, 95, 75, 0.25);
  }

  .filing-metric-card.warning {
    border-color: rgba(139, 63, 55, 0.25);
  }

  .indicator-card.positive {
    border-color: rgba(47, 95, 75, 0.25);
  }

  .indicator-card__value {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 20px;
    color: #1d2935;
  }

  .indicator-card p {
    font-size: 10.5px;
    line-height: 1.42;
    color: #4d5860;
  }

  .indicator-table,
  .trend-table,
  .omission-list,
  .benchmark-table {
    display: grid;
    gap: 8px;
  }

  .indicator-row,
  .trend-row,
  .omission-row,
  .benchmark-row {
    display: grid;
    gap: 8px;
    align-items: center;
    padding: 9px 10px;
    border: 1px solid #e0d7c8;
    border-radius: 12px;
    background: #fffdf8;
    break-inside: avoid;
  }

  .indicator-row {
    grid-template-columns: 1.1fr 0.7fr 2fr;
  }

  .trend-row {
    grid-template-columns: 1.1fr 0.75fr 0.75fr 0.75fr 0.75fr 2fr;
  }

  .benchmark-row {
    grid-template-columns: 0.8fr 0.6fr 0.9fr 2.1fr;
  }

  .omission-row {
    grid-template-columns: 1fr 3fr;
  }

  .indicator-row span,
  .trend-row span,
  .benchmark-row span,
  .omission-row strong {
    font-size: 10.4px;
    font-weight: 700;
    color: #1d2935;
  }

  .indicator-row strong,
  .trend-row strong,
  .benchmark-row strong {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 13px;
    color: #1d2935;
  }

  .indicator-row em,
  .trend-row em,
  .benchmark-row em,
  .omission-row span {
    font-size: 9.8px;
    font-style: normal;
    line-height: 1.35;
    color: #5f686d;
  }

  .benchmark-row small {
    font-size: 9.4px;
    color: #6f766f;
  }

  .benchmark-row.above {
    border-left: 4px solid #8b3f37;
  }

  .benchmark-row.below {
    border-left: 4px solid #2f5f4b;
  }

  .benchmark-row.near,
  .benchmark-row.unavailable {
    border-left: 4px solid #c0a060;
  }

  .education-card {
    border: 1px solid #e0d7c8;
    background: #fffdf8;
    border-radius: 16px;
    padding: 12px;
    display: grid;
    gap: 7px;
    break-inside: avoid;
  }

  .education-card h3 {
    margin: 0;
    font-size: 15px;
    font-family: Georgia, "Times New Roman", serif;
    color: #1d2935;
  }

  .education-card p,
  .education-card small {
    margin: 0;
    font-size: 10.4px;
    line-height: 1.42;
    color: #4d5860;
  }

  .education-card small {
    color: #7e6337;
    font-style: italic;
  }

  .trend-row.improving {
    border-left: 4px solid #2f5f4b;
  }

  .trend-row.weakening {
    border-left: 4px solid #8b3f37;
  }

  .trend-row.mixed,
  .trend-row.unchanged,
  .trend-row.unavailable {
    border-left: 4px solid #c0a060;
  }

  .filing-metric-card__top,
  .filing-metric-card__values {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .filing-metric-card__move {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    color: #1d2935;
  }

  .filing-metric-card__values {
    font-size: 10px;
    color: #6a706f;
  }

  .filing-gbi .editorial-card p {
    font-size: 11px;
    line-height: 1.42;
  }

  .chart-label {
    font-weight: 700;
  }

  .chart-value {
    font-weight: 700;
  }

  .chart-axis {
    font-size: 9px;
    fill: #7b756b;
    font-weight: 700;
  }
`;
