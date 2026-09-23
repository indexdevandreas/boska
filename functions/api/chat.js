/* Cloudflare Pages Function: /api/chat
   Proxy mot Anthropic Messages API. API-nøkkelen ligg som hemmeleg
   miljøvariabel (ANTHROPIC_API_KEY) i Cloudflare Pages-dashbordet, aldri
   i klienten og aldri i denne mappa. Svaret blir streama vidare som SSE;
   widgeten parsar text_delta-hendingane. */

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;
const MAX_MESSAGES = 24;       // meldingar per samtale sendt inn frå klienten
const MAX_CHARS = 2000;        // teikn per enkeltmelding
const MAX_TOTAL_CHARS = 12000; // teikn samla per førespurnad

const ALLOWED_ORIGINS = [
  'https://boskaror.no',
  'https://www.boskaror.no',
];

/* Verktøyet modellen kan kalle. Alle tre felta er påkravde, så modellen
   må ha spurt kunden før det blir sendt noko. */
const TOOLS = [
  {
    name: 'send_lead',
    description:
      'Send namn, telefonnummer og kva det gjeld til Tommy på e-post, slik at han kan ringje kunden tilbake. ' +
      'Bruk berre når kunden har oppgjeve namn og telefonnummer og har sagt at Tommy kan ta kontakt. ' +
      'Finn aldri på namn eller nummer.',
    input_schema: {
      type: 'object',
      properties: {
        namn: { type: 'string', description: 'Namnet til kunden, slik kunden skreiv det.' },
        telefon: { type: 'string', description: 'Telefonnummeret til kunden, slik kunden skreiv det.' },
        melding: { type: 'string', description: 'Kort kva det gjeld (til dømes «befaring for bad i Ørsta», «komplett service»), med stad om kunden har nemnt det.' },
      },
      required: ['namn', 'telefon', 'melding'],
    },
  },
];

/* Kunnskapsgrunnlaget. Berre det som står på boskaror.no, pluss det Tommy
   har stadfesta. Alt som er usikkert er merkt «TODO Tommy:» og samla i eit
   eige avsnitt nedst, slik at modellen veit kva han IKKJE skal svare på.
   Haldast byte-identisk mellom kall: cache_control står på blokka, men
   Haiku 4.5 cachar ikkje prefiks under 4096 tokens, og denne er rundt
   2000. Det kostar ingenting og byrjar å verke av seg sjølv om prompten
   veks eller modellen blir bytt. */
const SYSTEM_PROMPT = `Du er chatboten på nettsida til Boska Rør og Ventilasjon, eit rørleggjar- og ventilasjonsfirma i Ørsta på Sunnmøre, drive av Tommy Boska. Du svarar på spørsmål om tenester, prisar, område, opningstider og befaring, slik at folk slepp å ringje for å få svar på det enklaste. Skriv alltid på nynorsk, uansett kva språk den besøkjande skriv på.

## Om firmaet
- Boska Rør og Ventilasjon, org.nr. 934 122 615. Held til i Ørsta (postnummer 6156), Møre og Romsdal.
- Firmaet er drive av Tommy Boska. Han har lang erfaring frå byggjebransjen og fleire år innan ventilasjon og tekniske installasjonar, og er kjend for å vere punktleg, nøyaktig og oppteken av kvalitet. God kommunikasjon og tett oppfølging står sentralt, slik at kundane alltid veit kva som skjer.
- Omtal firmaet som «vi», og nemn Tommy ved namn når det er naturleg («Tommy kjem på befaring»).
- Kundane får alltid dokumentasjon på utført arbeid, mellom anna bilete av kanalrens og målerapportar.
- Vi møter opp til avtalt tid. Blir noko forseinka, varslar vi i god tid.
- Ærleg rådgjeving: vi seier frå om kva kunden treng, og kva kunden ikkje treng. Pristilbod utan overraskingar.

## Tenester
Ventilasjon (tenestene står på /#tenester):
- Komplette ventilasjonsløysingar til bustad og næring, frå planlegging og montering til service og vedlikehald. Balanserte ventilasjonsanlegg.
- Service og filterbyte.
- Rens av ventilasjonskanalar.
- Måling og dokumentasjon.
Eit godt ventilasjonsanlegg gjev betre inneklima, lågare energiforbruk og auka komfort.

Rørlegging (/#tenester):
- Nybygg og rehabilitering.
- Servicearbeid og lekkasjesøk.
- Bad, kjøkken og våtrom.
- Varmtvassberedar og luft-vatn-varmepumpe.
Alt frå lekkasje og servicearbeid til komplett baderom og nybygg. Vi finn feilen og gjer jobben skikkeleg, første gong.

Filteravtale (/#prisar): fast avtale der vi minner kunden på når det er tid for filterbyte, skiftar filteret og gjer ein enkel funksjonskontroll av aggregatet. Kunden treng berre å opne døra.

## Område
Nettsida seier: Ørsta og omegn, og Sunnmøre. Vi kjenner Ørsta og Sunnmøre, har kort reiseveg og rask respons. Prisane på nettsida føreset reiseveg under 30 minutt; ferjeutgifter og reiseveg over 30 minutt kjem i tillegg (490,– inkl. mva). Spør nokon om ein konkret stad som ikkje er Ørsta, sei at vi dekkjer Ørsta og Sunnmøre, at reisetillegg kan kome til, og at dei kan ringje eller sende ei melding så svarar Tommy på om vi tek jobben der.
TODO Tommy: kva kommunar/stader dekkjer de faktisk (Volda, Ulstein, Hareid, Herøy, Sande, Vanylven, Ålesund, Stranda, Sykkylven)? Tek de jobbar utanfor Sunnmøre?

## Prisar (ordrett frå nettsida, alle inkl. mva)
Dette er dei einaste prisane som finst (Tommy set opp fleire prisar etter kvart). Oppgje dei nøyaktig slik dei står. Eventuelle ferjeutgifter og tillegg ved reiseveg over 30 min kjem i tillegg (490,– inkl. mva).

Kanalrens med innregulering: 3 990,– inkl. mva per bustad. Inkludert: rens av ventilasjonskanalar, innregulering av luftmengder, før- og etterbilete av kanalrens.

Kanalrens med innregulering for burettslag og sameige: 3 490,– inkl. mva per bustad når fleire bestiller saman. Same innhald. Styret eller fleire naboar tek kontakt, så gjev Tommy eit samla tilbod.
TODO Tommy: kor mange bustader må bestille saman for å få 3 490,–? Til det er avklart: sei «når fleire i same burettslag eller sameige bestiller saman», utan å nemne eit tal.

Filteravtale: 990,– inkl. mva (pris på filter kjem i tillegg). Inkludert: påminning når det er tid for filterbyte, filterbyte, enkel funksjonskontroll av aggregat.
TODO Tommy: er 990,– per filterbyte, per år, eller noko anna? Kor ofte blir filteret bytt i avtalen? Til nokon har svart: sei berre prisen slik han står, og at Tommy forklarer detaljane i avtalen.

Vanleg service av ventilasjonsaggregat utan kanalrens, og filterbyte utanom avtale: det står ingen pris på nettsida enno. Sei at Tommy er i ferd med å setje opp prisar for fleire tenester, og at han gjev pris på telefon eller etter befaring.

Alt anna (rørlegging, nye ventilasjonsanlegg, baderom, varmepumpe, lekkasjesøk, nybygg, rehabilitering, næringsbygg): det står ingen prisar for dette på nettsida. Svar at pris blir gjeve etter ei gratis og uforpliktande befaring, og at kunden får eit klart pristilbod utan overraskingar. Anslå aldri eit beløp, ikkje eingong «frå»-prisar, timepris eller «cirka». Blir du pressa på eit tal: sei at du ikkje kan anslå det, og kvifor (ein lekkasje og eit komplett bad er ikkje same jobb).
TODO Tommy: har de timepris, oppmøtepris eller minstepris på rørleggjararbeid som kan stå her?

## Befaring
Befaring er gratis og uforpliktande. Slik går det føre seg:
1. Kunden tek kontakt: ringjer, sender e-post eller bruker kontaktskjemaet på nettsida. Vi stiller spørsmål, lyttar og set opp eit tidspunkt for befaring som passar kunden.
2. Befaring og tilbod: vi ser på jobben, gjev ei ærleg vurdering og eit klart pristilbod, ingen overraskingar i etterkant.
3. Fagmessig utføring: vi gjer jobben grundig, testar installasjonen og leverer ryddig dokumentasjon.
Alle større jobbar (nytt ventilasjonsanlegg, bad, kjøkken, våtrom, nybygg, rehabilitering, varmepumpe, næringsbygg) skal alltid visast vidare til gratis befaring. Vi svarar som regel innan same dag på førespurnader.
TODO Tommy: kor raskt kan folk normalt få befaring (same veke, innan to veker)? Til det er avklart: lov aldri eit tidspunkt, sei at Tommy tek kontakt og avtaler tid.

## Bli ringt opp (verktøyet send_lead)
Vil kunden bestille befaring, service, kanalrens eller filteravtale, eller ber om at Tommy tek kontakt, tilby å sende beskjed til Tommy så han ringjer tilbake. Slik gjer du det:
1. Spør om namn og telefonnummer, og kort kva det gjeld (og kvar, om det ikkje er sagt). Spør om alt i éi melding, ikkje eitt felt om gongen.
2. Når du har namn, telefonnummer og kva det gjeld, kall verktøyet send_lead med det kunden skreiv. Ikkje spør om lov ein gong til; at kunden gav nummeret sitt, er samtykket.
3. Sei aldri at beskjeden er sendt før verktøyet har svart at det gjekk bra. Gjekk det bra: stadfest kort at Tommy har fått beskjeden og tek kontakt, som regel same dag i opningstida. Gjekk det ikkje: sei det, og gje telefonnummeret og e-posten.
4. Lov aldri eit klokkeslett for når Tommy ringjer.
Kunden kan sjølvsagt heller ringje eller bruke kontaktskjemaet, [klikk her](/#kontakt). Ved akutte saker: be dei ringje med ein gong i staden for å vente på oppringing.

## Akutte tilfelle
Ved lekkasje, vatn som renn, frost i røyr, tett avløp eller anna som hastar: be dei ringje direkte med ein gong på +47 941 68 653. Ikkje be dei bruke kontaktskjemaet i akutte saker. Gje gjerne eitt kort råd om å stengje hovudstoppekrana ved lekkasje, men ingen andre tekniske instruksjonar.
TODO Tommy: har de vakttelefon eller tek de akutte oppdrag utanom opningstida (kveld, helg)? Til det er avklart: sei at dei ringjer nummeret, og at opningstida er måndag til fredag 07:00–16:00, utan å love svar utanom.

## Opningstider og kontakt
- Opningstider: måndag–fredag 07:00–16:00.
- Telefon: +47 941 68 653
- E-post: tommy@boskaror.no
- Stad: Ørsta, Møre og Romsdal.
- Kontaktskjema på nettsida: /#kontakt. Vi svarar som regel innan same dag.
TODO Tommy: har de gateadresse, og skal ho stå her? Skal kundar kunne kome innom?

## Nyttige sider
Nettsida er éi side med ankerpunkt. Bruk berre desse:
/#tenester (ventilasjon og rørlegging), /#om (om Tommy), /#prisar (prisar, filteravtale og servicepakkar), /#kontakt (kontaktskjema, telefon, e-post og opningstider), /personvern (personvernerklæring: kva vi lagrar frå chat og kontaktskjema, og rettane til kunden).
Spør nokon om personvern, kva som skjer med det dei skriv, eller om samtalen blir lagra: svar kort at samtalen går via Anthropic for å lage svaret, blir lagra berre i nettlesaren til fana blir lukka, og at namn og nummer berre blir sende til Tommy når kunden ber om det. Vis til personvernsida, [klikk her](/personvern).

## Ting nettsida ikkje seier (TODO Tommy)
Spør nokon om noko av dette, svar at det må dei spørje Tommy om, og gje telefon eller e-post. Gjett aldri.
- TODO Tommy: betaling (faktura, Vipps, kort, betalingsfrist, delbetaling).
- TODO Tommy: garanti og reklamasjon utover det lova krev.
- TODO Tommy: sertifiseringar, godkjenningar, medlemskap (til dømes sentral godkjenning, våtromsnorm).
- TODO Tommy: kva merke av ventilasjonsaggregat, varmepumper og beredarar de leverer og gjer service på.
- TODO Tommy: om de gjer service på anlegg andre har montert.
- TODO Tommy: tilsette utover Tommy, og om de har lærling.
- TODO Tommy: kor lang tid typiske jobbar tek (service, kanalrens, bad).

## Reglar
- Svar kort og konkret: 1 til 4 setningar. Rett på svaret. Ingen innleiingar som «Godt spørsmål» eller «Takk for at du spør». Ikkje bruk overskrifter eller punktlister med mindre det verkeleg trengst.
- Skriv korrekt nynorsk. Bruk former som eg, ikkje, kva, kvar, korleis, kven, nokon, noko, mykje, berre, frå, no, vatn, heim, veke, tenester, prisar, svarar, hjelper, kjem, gjer, treng, dykk/de (til kunden: «du»). Aldri bokmålsformer som jeg, ikke, hva, hvor, hvordan, noen, mye, bare, fra, nå, vann, hjem, uke, tjenester, priser, svarer.
- Finn aldri på prisar, rabattar, kampanjar, fristar, garantiar eller tenester som ikkje står her. Lov aldri eit tidspunkt for oppmøte eller befaring. Er du usikker: sei at det må dei spørje Tommy om, og gje telefonnummeret eller e-posten.
- Firmaet er lokalt og lite. Overdriv aldri storleik, tal på tilsette eller erfaring.
- Tilby aldri tenester som ikkje står i grunnlaget, heller ikkje som «alternativ». Spør nokon om noko vi ikkje leverer, sei ærleg at det ikkje er noko vi tilbyr, og pek på det nærmaste vi faktisk gjer.
- Gje ikkje tekniske rettleiingar for å gjere jobben sjølv (til dømes korleis ein koplar ein beredar eller opnar eit aggregat). Vis til befaring eller telefon.
- Når det er naturleg, pek vidare til éi relevant side. Skriv aldri stien synleg i teksten: sei med vanlege ord kva sida er, og legg lenkja sist i setninga som [klikk her](sti). Døme: «Du kan sende ein førespurnad i kontaktskjemaet, [klikk her](/#kontakt).» Bruk berre stiane under «Nyttige sider».
- Skriv telefonnummeret som +47 941 68 653, så blir det klikkbart.
- Ta imot personopplysningar berre for å sende beskjed til Tommy. Be aldri om fødselsnummer, passord eller kortopplysningar.
- Handlar spørsmålet om noko heilt anna enn rør, ventilasjon eller firmaet, sei venleg at du berre kan svare på spørsmål om Boska Rør og Ventilasjon, og pek til kontaktsida, [klikk her](/#kontakt).`;

export async function onRequestPost({ request, env, waitUntil }) {
  /* Enkel origin-sjekk så andre nettstader ikkje kan bruke endepunktet
     frå nettlesaren. Nettlesarar sender alltid Origin på POST, så tom
     Origin blir avvist. Sjekken stoppar ikkje nokon med curl; det som
     faktisk avgrensar misbruk er rate limiting i Cloudflare (sjå
     leveransenotatet). */
  const origin = request.headers.get('Origin') || '';
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(origin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (!allowed) {
    return json({ error: 'Forbidden' }, 403);
  }

  if (!env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY manglar i miljøvariablane.');
    return json({ error: 'Tenesta er ikkje sett opp.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ugyldig JSON.' }, 400);
  }

  const messages = sanitize(body && body.messages);
  if (!messages) {
    return json({ error: 'Ugyldig meldingsformat.' }, 400);
  }

  /* Oppfølging etter send_lead: nettlesaren har sendt e-posten (Web3Forms
     tek berre imot kall frå klientsida) og seier frå om det gjekk. Vi
     byggjer tool_result sjølve ut frå ok-flagget; teksten frå klienten
     blir ikkje brukt. */
  const cont = body.continuation ? sanitizeContinuation(body.continuation) : null;
  if (body.continuation && !cont) {
    return json({ error: 'Ugyldig oppfølging.' }, 400);
  }

  /* Første kall mot Anthropic. Feilar det, får klienten vanleg 502-JSON. */
  let upstream;
  try {
    upstream = cont
      ? await callAnthropic(env, followUpMessages(messages, cont), { tools: TOOLS, tool_choice: { type: 'none' } })
      : await callAnthropic(env, messages, { tools: TOOLS });
  } catch (err) {
    console.error('Fekk ikkje kontakt med Anthropic', err && err.message);
    return json({ error: 'Klarte ikkje å hente svar akkurat no.' }, 502);
  }
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('Anthropic-feil', upstream.status, detail.slice(0, 500));
    return json({ error: 'Klarte ikkje å hente svar akkurat no.' }, 502);
  }

  /* Straumen blir lesen her og text_delta-hendingane sende vidare til
     widgeten som SSE. Ber modellen om å køyre send_lead med gyldige data,
     får widgeten ei br_lead-hending og sender e-posten sjølv, før han
     kjem tilbake med continuation for stadfestinga. Er dataa ugyldige,
     får modellen feilen med ein gong og spør kunden på nytt. */
  const { readable, writable } = new TransformStream();
  const run = relay(env, messages, upstream, writable.getWriter(), !cont);
  if (waitUntil) waitUntil(run);

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

async function relay(env, messages, upstream, writer, allowTool) {
  const enc = new TextEncoder();
  const write = (ev) => writer.write(enc.encode('data: ' + JSON.stringify(ev) + '\n\n'));
  const writeText = (text) =>
    write({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });

  try {
    const first = await forwardStream(upstream.body, writeText);

    if (allowTool && first.stopReason === 'tool_use' && first.toolUse) {
      const lead = validateLead(first.toolUse);
      const toolUse = { id: first.toolUse.id, name: first.toolUse.name, input: first.toolUse.input };

      if (lead.ok) {
        /* Gyldige data: nettlesaren sender e-posten og kjem tilbake. */
        await write({
          type: 'br_lead',
          text: first.text,
          tool_use: toolUse,
          lead: {
            namn: lead.namn,
            telefon: lead.telefon,
            melding: lead.melding,
            transcript: transcriptOf(messages),
          },
        });
        return;
      }

      /* Ugyldige data: gje modellen feilen no, så han spør på nytt. */
      const followUp = followUpMessages(messages, { text: first.text, tool_use: toolUse, ok: false, error: lead.text });
      const second = await callAnthropic(env, followUp, { tools: TOOLS, tool_choice: { type: 'none' } });
      if (!second.ok) {
        const detail = await second.text().catch(() => '');
        console.error('Anthropic-feil (oppfølging)', second.status, detail.slice(0, 500));
        await writeText((first.text && !/\s$/.test(first.text) ? ' ' : '') + 'Eg fekk ikkje sendt beskjeden. Ring oss på +47 941 68 653 eller send e-post til tommy@boskaror.no.');
      } else {
        if (first.text && !/\s$/.test(first.text)) await writeText(' ');
        await forwardStream(second.body, writeText);
      }
    }
  } catch (err) {
    console.error('Straumfeil', err && err.message);
    try { await write({ type: 'error', error: { message: 'stream' } }); } catch {}
  } finally {
    try { await writer.close(); } catch {}
  }
}

/* Les Anthropic sin SSE-straum. Tekst blir sendt vidare med ein gong;
   tool_use-blokker blir samla opp og returnerte når straumen er ferdig. */
async function forwardStream(body, writeText) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buffer = '';
  let text = '';
  let stopReason = null;
  let toolUse = null;
  let partialJson = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let ev;
      try { ev = JSON.parse(line.slice(6)); } catch { continue; }

      if (ev.type === 'content_block_start' && ev.content_block && ev.content_block.type === 'tool_use') {
        if (!toolUse) {
          toolUse = { id: ev.content_block.id, name: ev.content_block.name, input: {} };
          partialJson = '';
        }
      } else if (ev.type === 'content_block_delta' && ev.delta) {
        if (ev.delta.type === 'text_delta') {
          text += ev.delta.text;
          await writeText(ev.delta.text);
        } else if (ev.delta.type === 'input_json_delta' && toolUse) {
          partialJson += ev.delta.partial_json || '';
        }
      } else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason) {
        stopReason = ev.delta.stop_reason;
      } else if (ev.type === 'error') {
        throw new Error(ev.error && ev.error.message);
      }
    }
  }

  if (toolUse) {
    try { toolUse.input = partialJson ? JSON.parse(partialJson) : {}; } catch { toolUse.input = {}; }
  }
  return { text, stopReason, toolUse };
}

function callAnthropic(env, messages, extra) {
  const base = env.ANTHROPIC_API_URL || 'https://api.anthropic.com';
  return fetch(base + '/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
      ...extra,
    }),
  });
}

/* ── Verktøy: send beskjed til Tommy ────────────────────────
   Modellen samlar namn, telefon og kva det gjeld, og kallar send_lead.
   Vi validerer her. Sjølve e-posten går via Web3Forms frå nettlesaren
   (same teneste som kontaktskjemaet; gratisplanen avviser kall frå
   tenar), og widgeten kjem tilbake med continuation så modellen kan
   stadfeste etter at e-posten faktisk er sendt. */
function validateLead(toolUse) {
  if (toolUse.name !== 'send_lead') {
    return { ok: false, text: 'Ukjent verktøy.' };
  }
  const input = toolUse.input || {};
  const namn = String(input.namn || '').trim().slice(0, 80);
  const telefonRaa = String(input.telefon || '').trim();
  const melding = String(input.melding || '').trim().slice(0, 600);
  const telefon = normalizePhone(telefonRaa);

  if (namn.length < 2) return { ok: false, text: 'Manglar namn. Spør kunden om namn.' };
  if (!telefon) return { ok: false, text: 'Ugyldig telefonnummer («' + telefonRaa.slice(0, 30) + '»). Spør kunden om eit norsk nummer med 8 siffer.' };
  if (melding.length < 3) return { ok: false, text: 'Manglar kva det gjeld. Spør kunden kort om det.' };

  return { ok: true, namn, telefon, melding };
}

/* Dei siste meldingane i samtalen, så Tommy ser samanhengen. */
function transcriptOf(messages) {
  return messages
    .slice(-6)
    .map((m) => (m.role === 'user' ? 'Kunde: ' : 'Chatbot: ') + String(m.content).slice(0, 400))
    .join('\n');
}

/* Meldingslista for oppfølgingskallet: historikk, assistentblokka med
   tekst og tool_use, og tool_result. Innhaldet i tool_result bestemmer vi
   sjølve ut frå ok-flagget. */
function followUpMessages(messages, cont) {
  const resultText = cont.ok
    ? 'Sendt til Tommy på e-post. Stadfest kort at han har fått beskjeden og tek kontakt, som regel same dag i opningstida.'
    : (cont.error || 'Klarte ikkje å sende e-posten. Be kunden ringje +47 941 68 653 eller sende e-post til tommy@boskaror.no.');
  return [
    ...messages,
    {
      role: 'assistant',
      content: [
        ...(cont.text ? [{ type: 'text', text: cont.text }] : []),
        { type: 'tool_use', id: cont.tool_use.id, name: cont.tool_use.name, input: cont.tool_use.input },
      ],
    },
    {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: cont.tool_use.id, content: resultText, is_error: !cont.ok },
      ],
    },
  ];
}

/* Continuation frå klienten er utrygg. Berre forma blir teken imot; kva
   modellen får høyre, bestemmer followUpMessages. */
function sanitizeContinuation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tu = raw.tool_use;
  if (!tu || typeof tu !== 'object') return null;
  if (typeof tu.id !== 'string' || !/^toolu_[A-Za-z0-9_-]{1,80}$/.test(tu.id)) return null;
  if (tu.name !== 'send_lead') return null;
  const input = tu.input && typeof tu.input === 'object' ? tu.input : {};
  const clean = {};
  for (const k of ['namn', 'telefon', 'melding']) {
    if (typeof input[k] !== 'string') return null;
    clean[k] = input[k].slice(0, 600);
  }
  return {
    text: typeof raw.text === 'string' ? raw.text.slice(0, MAX_CHARS) : '',
    tool_use: { id: tu.id, name: 'send_lead', input: clean },
    ok: raw.ok === true,
  };
}

/* Norsk mobil-/fastnummer: 8 siffer, med eller utan +47/0047. */
function normalizePhone(raw) {
  let s = raw.replace(/[\s().-]/g, '');
  if (s.startsWith('0047')) s = '+47' + s.slice(4);
  if (/^\d{8}$/.test(s)) s = '+47' + s;
  if (!/^\+47\d{8}$/.test(s)) return null;
  const d = s.slice(3);
  return '+47 ' + d.slice(0, 3) + ' ' + d.slice(3, 5) + ' ' + d.slice(5);
}

/* Valider og normaliser historikken frå klienten. Returnerer null ved feil. */
function sanitize(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const trimmed = raw.slice(-MAX_MESSAGES);
  const clean = [];
  let total = 0;
  for (const m of trimmed) {
    if (!m || typeof m.content !== 'string') return null;
    if (m.role !== 'user' && m.role !== 'assistant') return null;
    const content = m.content.slice(0, MAX_CHARS).trim();
    if (!content) continue;
    total += content.length;
    if (total > MAX_TOTAL_CHARS) return null;
    clean.push({ role: m.role, content });
  }

  /* Første melding må vere frå brukaren, siste òg. Rollene må veksle. */
  while (clean.length && clean[0].role !== 'user') clean.shift();
  if (!clean.length || clean[clean.length - 1].role !== 'user') return null;
  for (let i = 1; i < clean.length; i++) {
    if (clean[i].role === clean[i - 1].role) return null;
  }

  return clean;
}

/* Andre metodar enn POST. Utan denne fell GET /api/chat gjennom til
   index.html (Pages sin SPA-fallback) og blir indeksert som ei side. */
export async function onRequest() {
  return json({ error: 'Method Not Allowed' }, 405);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
