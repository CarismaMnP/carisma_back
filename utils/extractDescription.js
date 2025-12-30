const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();

// Helper to split "also fits" content by <br> / <li> and normalize into an array
const splitByBr = (el) => {
  if (!el) return { raw: '', items: [] };

  // If innerText already has newlines (browser), split by them
  if (typeof el.innerText === 'string' && el.innerText.includes('\n')) {
    const raw = el.innerText.trim();
    return {
      raw,
      items: raw.split('<br>').map(normalize).filter(Boolean),
    };
  }

  // Fallback: replace <br> and <li> with token, strip HTML
  const token = `__BR__${Math.random().toString(36).slice(2)}__`;
  const tmp = (typeof document !== 'undefined' ? document : el.ownerDocument)?.createElement('div') || {
    innerHTML: '',
    textContent: '',
  };
  tmp.innerHTML = (el.innerHTML || '')
    .replace(/<br\s*\/?>/gi, token)
    .replace(/<li>/gi, token)
    .replace(/<\/li>/gi, '');

  const raw = (tmp.textContent || '').trim();
  const items = raw.split(token).map(normalize).filter(Boolean);
  return { raw, items };
};

function extractCpcmVehicleData(input) {
  if (!input) {
    return {
      year: '',
      model: '',
      vin: '',
      vehicleInfo: '',
      additionalNotes: '',
      alsoFits: [],
      alsoFitsRaw: '',
    };
  }

  // Browser/DOM path
  if (typeof document !== 'undefined' && (typeof input === 'string' || input.querySelector)) {
    const doc =
      typeof input === 'string'
        ? new DOMParser().parseFromString(input, 'text/html')
        : input.ownerDocument
          ? input.ownerDocument
          : input;

    const root = input.querySelector ? input : doc;
    const pickText = (selector) => {
      const el = root.querySelector(selector);
      return (el?.textContent || '').replace(/\s+/g, ' ').trim();
    };

    const year = pickText('#cpcm_info-year .cpcm_label-content');
    const model = pickText('#cpcm_info-model .cpcm_label-content');
    const vin = pickText('#cpcm_info-vin .cpcm_label-content');
    const vehicleInfo = pickText('#cpcm_info-autDesc .cpcm_label-content');
    const additionalNotes = pickText('#cpcm_info-description .cpcm_label-content');

    const alsoFitsEl = root.querySelector('#cpcm_info-interchange .cpcm_label-content');
    const { raw: alsoFitsRaw, items: alsoFits } = splitByBr(alsoFitsEl);

    return { year, model, vin, vehicleInfo, additionalNotes, alsoFits, alsoFitsRaw };
  }

  // Node path: regex on HTML
  const html = String(input);
  const pickById = (id, { multiline = false } = {}) => {
    const re = new RegExp(
      `<li[^>]*id=["']${id}["'][^>]*>[\\s\\S]*?<span[^>]*cpcm_label-content[^>]*>([\\s\\S]*?)</span>`,
      'i'
    );
    const match = html.match(re);
    if (!match) return '';
    const raw = match[1];
    const normalized = multiline
      ? raw.replace(/<br\s*\/?>/gi, '\n')
      : raw.replace(/<br\s*\/?>/gi, ' ');
    return normalized.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const alsoFitsRaw = (() => {
    const re = new RegExp(
      `<li[^>]*id=["']cpcm_info-interchange["'][^>]*>[\\s\\S]*?<span[^>]*cpcm_label-content[^>]*>([\\s\\S]*?)</span>`,
      'i'
    );
    const m = html.match(re);
    if (!m) return '';
    return m[1]
      // .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li>/gi, '\n')
      .replace(/<\/li>/gi, '')
      // .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  })();

  console.log("alsoFitsRaw")
  console.log(alsoFitsRaw)
  const alsoFits = alsoFitsRaw
    ? alsoFitsRaw
        .split("<br>")
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    : [];

  return {
    year: pickById('cpcm_info-year'),
    model: pickById('cpcm_info-model'),
    vin: pickById('cpcm_info-vin'),
    vehicleInfo: pickById('cpcm_info-autDesc'),
    additionalNotes: pickById('cpcm_info-description'),
    alsoFits,
    alsoFitsRaw,
  };
}

module.exports = { extractCpcmVehicleData };
