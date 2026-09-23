(function () {
  'use strict';

  /* ── Chat for Boska Rør og Ventilasjon ─────────────────────
     Widgeten snakkar med /api/chat (Cloudflare Pages Function)
     som proxyar til Anthropic-API-et og streamar svaret som SSE.
     API-nøkkelen finst berre på tenarsida.
     Historikken ligg i sessionStorage så samtalen overlever
     sidebyte, men blir nullstilt når fana blir lukka.
     Alle id-ar og klassar har prefikset br- så ingenting
     kolliderer med style.css.
  ────────────────────────────────────────────────────────── */

  const API_URL = '/api/chat';
  const STORE_KEY = 'br-history-v1';
  const MAX_HISTORY = 24;          /* same grense som tenaren */
  const REQUEST_TIMEOUT_MS = 60000;
  const PHONE_DISPLAY = '+47 941 68 653';
  const PHONE_TEL = '+4794168653';
  const EMAIL = 'tommy@boskaror.no';

  const WELCOME =
    'Hei! Spør meg om prisar, tenester, område eller befaring, ' +
    'så svarar eg med ein gong.';
  const STARTERS = [
    'Kva kostar det?',
    'Kva område dekkjer de?',
    'Kan eg bestille befaring?',
  ];
  const ERROR_MSG =
    'Orsak, eg fekk ikkje kontakt med tenaren akkurat no. ' +
    'Prøv igjen om litt, eller ring oss på ' +
    '<a href="tel:' + PHONE_TEL + '">' + PHONE_DISPLAY + '</a> ' +
    'eller send e-post til <a href="mailto:' + EMAIL + '">' + EMAIL + '</a>.';

  /* Logomerket (dråpe og B) er henta ordrett frå splash-en i index.html
     og teikna med currentColor, så det blir kvitt på den blå bobla og i
     headeren utan ekstra nettverkskall. */
  const LOGO_SVG = '<svg viewBox="0 0 288 274" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="M113.8,54.5L120.3,63.5L126.1,71.6L131.4,78.9L136.1,85.3L140.2,90.8L143.6,95.4L146.5,99.1L148.7,102L150.3,104L151.8,105.9L153.2,107.7L154.5,109.3L155.7,110.9L156.8,112.4L157.8,113.7L158.6,114.9L159.4,116.1L160.2,117.4L161,118.9L161.9,120.6L162.8,122.4L163.8,124.5L164.9,126.8L165.9,129.2L167.1,131.8L168.1,134.4L169,136.9L169.9,139.3L170.6,141.7L171.3,144L171.8,146.3L172.3,148.4L172.7,150.6L173,152.6L173.3,154.5L173.5,156.4L173.7,158.1L173.9,159.8L174,161.3L174,162.8L174,164.2L174,165.7L173.9,167.2L173.7,168.9L173.5,170.6L173.3,172.5L173,174.4L172.7,176.4L172.3,178.6L171.8,180.7L171.3,183L170.6,185.2L169.9,187.5L169,189.9L168.1,192.3L167.1,194.8L165.9,197.3L164.8,199.7L163.5,202L162.3,204.3L161,206.5L159.6,208.6L158.2,210.6L156.8,212.6L155.3,214.4L153.6,216.3L151.9,218.1L150.1,220L148.2,221.8L146.1,223.6L144,225.4L141.7,227.1L139.3,228.9L137,230.5L134.7,232L132.4,233.5L130.1,234.8L127.9,236L125.7,237.1L123.6,238.1L121.4,238.9L119.3,239.8L117.1,240.5L114.9,241.2L112.6,241.8L110.3,242.4L108,242.9L105.7,243.3L103.3,243.7L101.2,244L99.4,244.3L97.9,244.4L96.6,244.6L95.7,244.6L95,244.6L94.6,244.6L94.4,244.4L94.3,244.3L94.2,244.3L94.1,244.3L93.9,244.3L93.8,244.3L93.7,244.3L93.6,244.4L93.4,244.6L93.1,244.7L92.5,244.7L91.7,244.8L90.6,244.8L89.3,244.7L87.8,244.7L86,244.6L84,244.4L82.1,244.3L80.3,244.1L78.7,244L77.1,243.8L75.6,243.6L74.3,243.4L73.1,243.1L71.9,242.9L70.7,242.5L69.3,242.1L67.8,241.7L66.2,241.1L64.4,240.5L62.6,239.7L60.6,238.9L58.4,238.1L56.3,237.1L54.2,236.1L52.2,235.1L50.1,233.9L48,232.8L46,231.5L44,230.2L42,228.8L40,227.3L38,225.8L36.1,224.1L34.2,222.4L32.2,220.5L30.3,218.6L28.4,216.6L26.6,214.4L24.8,212.3L23.1,210.1L21.5,208L20,205.8L18.6,203.6L17.3,201.4L16.1,199.1L14.9,196.9L13.9,194.6L12.9,192.4L12,190.1L11.2,187.9L10.5,185.6L9.8,183.4L9.3,181.1L8.8,178.9L8.3,176.6L7.9,174.4L7.6,172.2L7.4,170L7.2,167.9L7.1,165.7L7,163.6L7,161.4L7.1,159.2L7.2,157L7.5,154.6L7.8,152.2L8.2,149.6L8.6,147L9.2,144.4L9.8,141.6L10.5,138.9L11.3,136.3L12.2,133.8L13.1,131.3L14.1,128.8L15.2,126.4L16.4,124.1L17.6,121.9L19.8,118.5L22.8,114L26.8,108.4L31.7,101.6L37.5,93.8L44.2,84.8L51.8,74.6L60.3,63.4L67.7,53.5L74.1,45L79.5,38L83.8,32.3L87,28L89.3,25.1L90.4,23.6L90.6,23.4L91.5,24.5L93.2,26.6L95.7,29.9L99,34.3L103.1,39.9L108,46.6Z M109.7,88.3L115.3,95.8L120.4,102.6L125,108.8L129,114.3L132.5,119.2L135.5,123.4L137.9,127L139.8,129.9L141.2,132.1L142.5,134.3L143.6,136.5L144.7,138.6L145.6,140.7L146.4,142.7L147.1,144.6L147.8,146.6L148.3,148.4L148.7,150.3L149.1,152.1L149.4,154L149.6,155.8L149.8,157.6L149.9,159.4L150,161.1L150,162.9L149.9,164.6L149.8,166.4L149.6,168.2L149.4,170L149.1,171.9L148.7,173.7L148.3,175.6L147.8,177.4L147.2,179.3L146.6,181.1L145.9,183L145.1,184.8L144.3,186.6L143.4,188.4L142.5,190.1L141.5,191.9L140.5,193.6L139.4,195.2L138.2,196.8L137,198.4L135.8,199.9L134.5,201.4L133.2,202.8L131.8,204.2L130.4,205.5L129,206.8L127.6,207.9L126.2,209.1L124.7,210.1L123.2,211.1L121.8,212.1L120.3,212.9L118.8,213.8L117.3,214.5L115.8,215.3L114.3,216L112.8,216.6L111.3,217.2L109.8,217.8L108.3,218.3L106.6,218.7L104.9,219.1L103.1,219.5L101.2,219.8L99.1,220L97,220.3L94.7,220.4L92.3,220.6L90,220.6L87.8,220.6L85.6,220.5L83.4,220.3L81.4,220L79.4,219.7L77.4,219.3L75.6,218.8L73.7,218.2L71.7,217.5L69.8,216.7L67.8,215.8L65.7,214.8L63.7,213.8L61.6,212.6L59.4,211.4L57.4,210.1L55.5,208.8L53.6,207.4L51.9,206.1L50.2,204.7L48.7,203.2L47.2,201.8L45.8,200.3L44.5,198.7L43.2,197L41.9,195.2L40.6,193.3L39.4,191.3L38.2,189.3L37.1,187.1L35.9,184.9L34.9,182.6L34,180.3L33.2,178L32.5,175.7L32,173.4L31.5,171L31.1,168.7L30.9,166.3L30.7,164L30.7,161.6L30.7,159.3L30.8,157L31,154.7L31.3,152.4L31.8,150.1L32.3,147.9L32.8,145.7L33.4,143.6L34,141.6L34.7,139.7L35.5,137.8L36.2,136L37.1,134.3L37.9,132.7L39.5,130.3L41.6,127L44.4,123L47.8,118.2L51.9,112.6L56.6,106.2L62,99L68,91L73.3,84L77.8,78L81.6,72.9L84.7,68.8L87,65.8L88.6,63.7L89.4,62.6L89.6,62.4L90.4,63.3L91.9,65L94.1,67.8L96.9,71.5L100.5,76.1L104.8,81.7Z"/><path d="M60.1,152.4L60.9,152.6L61.8,152.7L62.6,153L63.4,153.2L64.1,153.5L64.8,153.9L65.5,154.3L66.2,154.8L66.8,155.3L67.4,155.8L67.9,156.3L68.4,156.8L68.8,157.3L69.2,157.8L69.6,158.3L69.9,158.8L70.1,159.3L70.3,159.8L70.5,160.4L70.7,161.1L70.8,161.9L70.9,162.7L71,163.6L71,164.5L71,165.5L71,166.5L71.1,167.4L71.3,168.3L71.5,169.2L71.7,170L72,170.8L72.3,171.6L72.7,172.4L73.1,173.1L73.7,173.9L74.3,174.7L75,175.5L75.7,176.4L76.6,177.2L77.5,178.1L78.5,178.9L79.5,179.7L80.4,180.5L81.3,181.1L82.2,181.7L83,182.1L83.8,182.5L84.6,182.9L85.4,183.1L86.2,183.3L87.1,183.5L88.1,183.6L89.2,183.7L90.3,183.7L91.5,183.6L92.8,183.6L94.2,183.4L95.5,183.4L96.7,183.3L97.8,183.3L98.8,183.4L99.7,183.5L100.5,183.7L101.2,183.9L101.8,184.1L102.4,184.5L103.1,184.9L103.7,185.3L104.3,185.9L104.9,186.5L105.6,187.3L106.2,188.1L106.8,188.9L107.4,189.8L107.8,190.6L108.2,191.5L108.5,192.3L108.8,193.1L108.9,193.9L109,194.6L109,195.4L109,196.1L108.9,196.7L108.7,197.3L108.5,197.9L108.3,198.4L108,198.9L107.7,199.3L107.3,199.7L106.9,200L106.5,200.4L106,200.7L105.5,201L105,201.3L104.4,201.6L103.8,201.9L103.2,202.1L102.4,202.3L101.4,202.5L100.3,202.7L99,202.8L97.5,202.9L95.8,203L94,203L92,203L90.1,203L88.3,202.9L86.6,202.7L84.9,202.5L83.4,202.3L82,202L80.6,201.7L79.4,201.3L78.1,200.9L76.9,200.5L75.7,200L74.5,199.5L73.4,199L72.2,198.4L71.1,197.8L69.9,197.2L68.8,196.5L67.8,195.8L66.8,195.1L65.8,194.4L64.8,193.6L63.8,192.8L62.9,191.9L62.1,191.1L61.2,190.1L60.3,189L59.4,187.8L58.6,186.5L57.7,185L56.8,183.5L55.9,181.9L55.1,180.1L54.3,178.3L53.6,176.5L53,174.7L52.5,172.8L52.1,170.9L51.8,169L51.6,167L51.4,165L51.4,163.2L51.3,161.6L51.3,160.1L51.4,158.9L51.5,157.8L51.7,156.9L51.9,156.3L52.1,155.8L52.4,155.3L52.7,154.9L53,154.5L53.3,154.2L53.6,154L54,153.7L54.3,153.6L54.7,153.4L55,153.3L55.3,153.2L55.6,153.1L55.9,152.9L56.1,152.8L56.3,152.7L56.4,152.6L56.6,152.4L56.8,152.3L57.1,152.3L57.5,152.3L58,152.3L58.6,152.3L59.3,152.3Z"/><path transform="translate(-9 0)" d="M155.1,25L166.9,25L177.3,25L186.4,25L194.2,25.1L200.6,25.2L205.7,25.2L209.5,25.3L211.9,25.4L213.1,25.6L214.3,25.8L215.7,26L217.3,26.4L219,26.8L220.8,27.4L222.8,28L224.9,28.6L227.1,29.4L229.3,30.2L231.5,31.1L233.7,32.1L235.8,33.2L237.9,34.3L240,35.5L242,36.8L244,38.2L245.9,39.6L247.8,41.1L249.5,42.6L251.2,44.2L252.8,45.8L254.4,47.4L255.8,49.1L257.2,50.9L258.5,52.5L259.6,54.1L260.7,55.6L261.6,56.9L262.4,58.2L263.1,59.4L263.8,60.5L264.3,61.5L264.8,62.6L265.3,63.9L265.8,65.3L266.3,66.8L266.8,68.4L267.3,70.1L267.8,72L268.3,74L268.7,76L269.1,77.9L269.4,79.7L269.6,81.5L269.8,83.3L269.9,85L270,86.7L270,88.3L269.9,90L269.8,91.7L269.6,93.4L269.4,95.1L269.1,96.9L268.7,98.7L268.3,100.6L267.8,102.4L267.2,104.3L266.6,106L266,107.8L265.3,109.5L264.5,111.1L263.8,112.7L262.9,114.3L262.1,115.8L261.2,117.1L260.4,118.4L259.6,119.6L258.9,120.7L258.2,121.6L257.5,122.5L256.8,123.2L256.2,123.8L255.8,124.5L255.6,125.2L255.6,126L255.9,126.8L256.3,127.6L257,128.5L257.9,129.5L259.1,130.5L260.2,131.6L261.3,132.7L262.4,134L263.6,135.3L264.7,136.7L265.8,138.1L266.9,139.7L268.1,141.3L269.1,142.8L270,144.3L270.9,145.6L271.6,146.9L272.3,148L272.8,149.1L273.3,150.1L273.7,150.9L274.1,151.9L274.4,153L274.8,154.2L275.2,155.5L275.6,157L275.9,158.5L276.3,160.1L276.7,161.9L277,163.6L277.3,165.3L277.5,167L277.7,168.7L277.9,170.4L278,172L278,173.7L278,175.3L278,177L277.9,178.6L277.7,180.3L277.5,182L277.3,183.7L277,185.4L276.7,187.1L276.3,188.9L275.9,190.6L275.4,192.3L274.9,194L274.3,195.7L273.7,197.4L273.1,199L272.4,200.7L271.6,202.3L270.8,203.9L270,205.5L269.1,207.1L268.2,208.7L267.2,210.2L266.1,211.7L265.1,213.3L263.9,214.8L262.7,216.3L261.4,217.8L259.9,219.3L258.3,220.9L256.7,222.5L254.9,224.1L253,225.7L251,227.3L249.1,228.8L247.2,230.2L245.4,231.5L243.6,232.7L241.9,233.8L240.3,234.8L238.8,235.6L237.3,236.4L235.6,237.1L233.9,237.8L232,238.5L230,239.2L227.9,239.9L225.6,240.5L223.3,241.2L220.8,241.8L217.6,242.4L213.9,242.8L209.6,243.2L204.7,243.5L199.1,243.8L193,243.9L186.2,244L178.8,244L172.5,243.9L167.2,243.7L163,243.4L159.8,243.1L157.6,242.6L156.5,242L156.5,241.4L157.5,240.6L158.6,239.7L159.8,238.7L161.2,237.4L162.6,236.1L164.1,234.5L165.8,232.8L167.6,231L169.4,229L171.2,227.1L172.8,225.2L174.3,223.4L175.7,221.6L176.9,219.9L178.1,218.3L179.1,216.8L179.9,215.3L180.8,213.7L181.6,212.1L182.5,210.5L183.3,208.8L184.1,207L184.9,205.3L185.6,203.4L186.4,201.6L187.5,199.9L189,198.5L190.8,197.3L193,196.3L195.5,195.5L198.4,194.9L201.7,194.6L205.3,194.4L208.6,194.3L211.5,194.1L214,193.9L216.2,193.6L218,193.3L219.5,193L220.6,192.7L221.4,192.3L222.1,191.9L222.9,191.4L223.6,190.8L224.4,190.2L225.1,189.5L225.9,188.8L226.6,187.9L227.4,187.1L228,186.1L228.6,184.9L229.2,183.7L229.6,182.3L230,180.8L230.2,179.2L230.4,177.4L230.6,175.6L230.6,173.8L230.5,172L230.3,170.4L230,168.8L229.5,167.4L229,166L228.4,164.6L227.6,163.4L226.9,162.2L226.2,161.2L225.5,160.3L224.8,159.5L224.1,158.8L223.5,158.2L222.8,157.7L222.2,157.3L221.5,157L220.8,156.6L219.9,156.3L219.1,156L218.1,155.7L217.1,155.4L216.1,155.1L214.9,154.9L213.7,154.7L212.2,154.5L210.6,154.3L208.9,154.2L207,154.1L204.9,154L202.7,154L200.3,154L198.1,153.6L196.1,152.8L194.3,151.6L192.7,149.9L191.3,147.9L190,145.5L188.9,142.6L188.1,139.4L187.1,136.2L186.1,133.2L185.1,130.3L183.9,127.5L182.8,124.8L181.5,122.2L180.2,119.7L178.8,117.3L177.6,115.2L176.6,113.4L175.7,111.9L175,110.6L174.5,109.7L174.2,109L174,108.6L174,108.4L174.5,108.3L175.6,108.2L177.3,108.2L179.5,108.1L182.2,108L185.5,108L189.3,108L193.7,108L197.6,108L201,107.9L204,107.8L206.5,107.7L208.5,107.5L210.1,107.3L211.2,107.1L211.8,106.9L212.4,106.6L213,106.3L213.6,106L214.2,105.7L214.7,105.4L215.2,105L215.8,104.7L216.3,104.3L216.8,103.9L217.3,103.4L217.8,102.9L218.3,102.3L218.8,101.7L219.3,101.1L219.8,100.4L220.3,99.6L220.7,98.8L221.1,97.8L221.5,96.7L221.8,95.5L222,94.2L222.3,92.8L222.4,91.3L222.6,89.7L222.6,88.2L222.7,86.8L222.7,85.6L222.6,84.4L222.5,83.4L222.3,82.6L222.1,81.8L221.9,81.2L221.5,80.5L221.1,79.8L220.7,79.1L220.1,78.4L219.5,77.6L218.7,76.8L217.9,75.9L217.1,75.1L216.2,74.3L215.5,73.5L214.7,72.9L214,72.3L213.4,71.9L212.8,71.5L212.3,71.1L211.8,70.9L211.2,70.6L210.7,70.4L210.1,70.2L209.4,70L208.8,69.9L208.1,69.7L207.4,69.6L206.6,69.4L205.8,69.3L204.9,69.2L204,69.2L203,69.1L201.9,69L200.8,69L199.6,69L198.4,69L197.3,69L196.3,69L195.5,69.1L194.8,69.2L194.2,69.2L193.8,69.3L193.6,69.4L193.4,69.6L193.3,69.7L193.1,69.7L192.9,69.8L192.6,69.8L192.3,69.7L192,69.7L191.7,69.6L191.3,69.4L190.3,69.3L188.6,69.2L186.3,69.2L183.3,69.1L179.6,69L175.3,69L170.3,69L164.7,69L159.3,68.3L154.1,67L149.1,65L144.4,62.3L139.8,58.9L135.5,54.9L131.4,50.2L127.6,44.8L124.2,40.1L121.3,36L118.8,32.6L116.9,29.9L115.5,27.8L114.5,26.3L114,25.6L114,25.4L115.5,25.3L118.4,25.2L122.8,25.2L128.7,25.1L136,25L144.8,25Z"/></svg>';

  /* Samtalehistorikk i API-format: [{role, content}] */
  let history = [];
  let busy = false;

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) history = parsed.slice(-MAX_HISTORY);
      }
    } catch { history = []; }
  }
  function saveHistory() {
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history)); } catch {}
  }

  /* ── Formatering av modellsvar ─────────────────────────────
     Alt blir escapa først (XSS-vern), deretter enkel markdown:
     **feit**, [tekst](sti)-lenkjer, nakne ankerstiar, e-post og
     telefonnummer blir lenkjer. */
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function formatMessage(text) {
    const bitar = [];
    const gøym = (html) => { bitar.push(html); return '\u0000' + (bitar.length - 1) + '\u0000'; };
    let html = escapeHtml(text);
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    /* [tekst](sti): berre interne stiar, https, mailto og tel */
    html = html.replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|\/|mailto:|tel:)[^\s)]+)\)/g, (_, t, href) =>
      gøym('<a href="' + href + '"' + (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>'));
    /* Naken sti (/#kontakt, /personvern) som modellen likevel skulle skrive ut */
    html = html.replace(/(^|[\s(])(\/(?:#[a-z0-9-]+|[a-z0-9-]+\.html(?:#[a-z0-9-]+)?))/g, (_, f, sti) => f + gøym('<a href="' + sti + '">klikk her</a>'));
    html = html.replace(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi, (e) => gøym('<a href="mailto:' + e + '">' + e + '</a>'));
    /* +47 941 68 653 → klikkbar på mobil */
    html = html.replace(/\+47[\s ]?(\d{3})[\s ]?(\d{2})[\s ]?(\d{3})\b/g, (m, a, b, c) =>
      gøym('<a href="tel:+47' + a + b + c + '">' + m + '</a>'));
    html = html.replace(/\u0000(\d+)\u0000/g, (_, i) => bitar[+i]);
    return html.replace(/\n/g, '<br>');
  }

  /* ── Bygg DOM ───────────────────────────────────────────── */
  function buildWidget() {
    const bubble = document.createElement('button');
    bubble.id = 'br-bubble';
    bubble.type = 'button';
    bubble.setAttribute('aria-label', 'Opne chat');
    bubble.setAttribute('aria-expanded', 'false');
    bubble.setAttribute('aria-controls', 'br-window');
    bubble.innerHTML = `
      <span class="br-icon-chat">${LOGO_SVG}</span>
      <svg class="br-icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
      <span id="br-badge" class="br-hidden" aria-hidden="true"></span>`;

    const win = document.createElement('div');
    win.id = 'br-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Chat med Boska Rør og Ventilasjon');
    win.setAttribute('aria-modal', 'false');
    win.innerHTML = `
      <div id="br-header">
        <div class="br-mark">${LOGO_SVG}</div>
        <div class="br-header-info">
          <span class="br-header-name">Boska Rør og Ventilasjon</span>
          <span class="br-header-status">
            <span class="br-status-dot"></span>
            Svarar med ein gong
          </span>
        </div>
        <button id="br-close" type="button" aria-label="Lukk chat">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div id="br-messages" aria-live="polite"></div>
      <div id="br-buttons"></div>
      <form id="br-inputrow" autocomplete="off">
        <input id="br-input" type="text" maxlength="1000"
               placeholder="Skriv eit spørsmål …" aria-label="Skriv ei melding">
        <button id="br-send" type="submit" aria-label="Send">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </button>
      </form>
      <div id="br-footnote">KI-assistent. Samtalen blir sletta når du lukkar fana. <a href="/personvern">Personvern</a></div>`;

    document.body.appendChild(win);
    document.body.appendChild(bubble);
    return { bubble, win };
  }

  /* ── Meldingsbobler ────────────────────────────────────── */
  function addBubble(messagesEl, html, who) {
    const msg = document.createElement('div');
    msg.className = 'br-msg' + (who === 'user' ? ' br-user' : '');
    const bub = document.createElement('div');
    bub.className = 'br-bubble-msg';
    bub.innerHTML = html;
    msg.appendChild(bub);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bub;
  }

  function addTyping(messagesEl) {
    const bub = addBubble(
      messagesEl,
      '<span class="br-dot"></span><span class="br-dot"></span><span class="br-dot"></span>',
      'bot'
    );
    bub.classList.add('br-typing');
    bub.setAttribute('aria-label', 'Skriv …');
    return bub;
  }

  function renderStarters(buttonsEl, onPick) {
    buttonsEl.innerHTML = '';
    STARTERS.forEach((label) => {
      const btn = document.createElement('button');
      btn.className = 'br-btn';
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => onPick(label));
      buttonsEl.appendChild(btn);
    });
  }

  /* ── Send + stream ─────────────────────────────────────── */
  async function send(text, ui) {
    text = text.trim();
    if (busy || !text) return;
    busy = true;
    ui.buttonsEl.innerHTML = '';
    ui.input.disabled = true;
    ui.sendBtn.disabled = true;

    addBubble(ui.messagesEl, escapeHtml(text), 'user');
    history.push({ role: 'user', content: text });
    saveHistory();

    const typing = addTyping(ui.messagesEl);
    let answer = '';
    let answerBubble = null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop(); /* siste linje kan vere ufullstendig */

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let ev;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }

          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
            answer += ev.delta.text;
            if (!answerBubble) {
              typing.remove();
              answerBubble = addBubble(ui.messagesEl, '', 'bot');
            }
            answerBubble.innerHTML = formatMessage(answer);
            ui.messagesEl.scrollTop = ui.messagesEl.scrollHeight;
          } else if (ev.type === 'error') {
            throw new Error(ev.error && ev.error.message);
          }
        }
      }

      if (!answer) throw new Error('Tomt svar');
      history.push({ role: 'assistant', content: answer });
      saveHistory();
    } catch (err) {
      typing.remove();
      if (answerBubble) answerBubble.remove();
      /* Rull tilbake brukarmeldinga så historikken held seg gyldig */
      if (history.length && history[history.length - 1].role === 'user') {
        history.pop();
        saveHistory();
      }
      addBubble(ui.messagesEl, ERROR_MSG, 'bot');
    } finally {
      clearTimeout(timer);
      busy = false;
      ui.input.disabled = false;
      ui.sendBtn.disabled = false;
      if (isDesktop()) ui.input.focus();
    }
  }

  function isDesktop() {
    return window.matchMedia('(min-width: 481px)').matches;
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    const { bubble, win } = buildWidget();
    const messagesEl = win.querySelector('#br-messages');
    const buttonsEl = win.querySelector('#br-buttons');
    const form = win.querySelector('#br-inputrow');
    const input = win.querySelector('#br-input');
    const sendBtn = win.querySelector('#br-send');
    const badge = bubble.querySelector('#br-badge');
    const ui = { messagesEl, buttonsEl, input, sendBtn };
    let opened = false;

    loadHistory();

    function renderExisting() {
      addBubble(messagesEl, WELCOME, 'bot');
      if (history.length === 0) {
        renderStarters(buttonsEl, (label) => send(label, ui));
      } else {
        history.forEach((m) => {
          addBubble(
            messagesEl,
            m.role === 'user' ? escapeHtml(m.content) : formatMessage(m.content),
            m.role === 'user' ? 'user' : 'bot'
          );
        });
      }
    }

    function open() {
      win.classList.add('br-open');
      bubble.classList.add('br-open');
      bubble.setAttribute('aria-expanded', 'true');
      badge.classList.add('br-hidden');
      /* br-open på <html> lèt CSS-en låse bakgrunnsrullinga og gøyme
         nav-en når vindauget dekkjer heile skjermen på mobil. */
      document.documentElement.classList.add('br-open');
      if (!opened) {
        opened = true;
        renderExisting();
      }
      /* Ikkje auto-fokus på mobil: fokus opnar tastaturet oppå eit vindauge
         som nett gleid inn. */
      if (isDesktop()) input.focus();
    }

    function close() {
      win.classList.remove('br-open');
      bubble.classList.remove('br-open');
      bubble.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('br-open');
      bubble.focus();
    }

    bubble.addEventListener('click', () => {
      win.classList.contains('br-open') ? close() : open();
    });
    win.querySelector('#br-close').addEventListener('click', close);
    document.querySelectorAll('[data-open-chat]').forEach((b) => b.addEventListener('click', open));

    /* Lenkjer til ankerpunkt på same side: rull dit med same 64px-offset
       som main.js bruker for nav-en, og lukk chatten på mobil der
       vindauget dekkjer heile sida. */
    messagesEl.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="/#"], a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').split('#')[1];
      const target = id && document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      if (!isDesktop()) close();
      window.history.replaceState(null, '', '#' + id);
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value;
      input.value = '';
      send(text, ui);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && win.classList.contains('br-open')) close();
    });

    setTimeout(() => {
      if (!opened) badge.classList.remove('br-hidden');
    }, 4000);
  }

  /* Stilarket blir lasta med media="print" og bytt til all ved onload,
     så det ikkje blokkerer rendering. Blir vindauget sett inn i DOM-en
     før CSS-en er framme, ligg det ustyla i sideflyten eit augneblink og
     gjev layout shift. Vent difor til stilarket er lasta. */
  function whenStyled(fn) {
    const link = document.querySelector('link[href*="chatbot-widget.css"]');
    if (!link || link.media === 'all' || link.media === '') { fn(); return; }
    let done = false;
    const go = () => { if (!done) { done = true; fn(); } };
    link.addEventListener('load', go, { once: true });
    link.addEventListener('error', go, { once: true });
    setTimeout(go, 3000); /* aldri utan chat om onload skulle utebli */
  }

  function start() { whenStyled(init); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
