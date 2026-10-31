const axios = require('axios');
const {randomUUID} = require('crypto');
const addresses = require('../freight/addresses');
const sessions = new Map(), limits = new Map();
const SESSION_TTL = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
const fail = (status, message) => Object.assign(Error(message), {status});
const enabled = () => !!process.env.GOOGLE_PLACES_API_KEY;

// One API process currently serves checkout. Bound paid traffic and transient
// session memory; never persist Google prediction lists or log customer queries.
function admit(userId) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) throw fail(401, 'Please sign in');
  const now = Date.now();
  for (const [key, value] of limits) if (now - value.hourStart >= 3600000) limits.delete(key);
  for (const [key, value] of sessions) if (now - value.started >= SESSION_TTL) sessions.delete(key);
  const keys = [`user:${userId}`, 'global'];
  for (const key of keys) {
    let value = limits.get(key);
    if (!value) {
      if (limits.size >= 10000) throw fail(429, 'Address suggestions are busy. You can enter the address manually.');
      value = {hourStart: now, minuteStart: now, hour: 0, minute: 0}; limits.set(key, value);
    }
    if (now - value.minuteStart >= 60000) {value.minuteStart = now; value.minute = 0;}
    if (value.minute >= (key === 'global' ? 1000 : 120) || value.hour >= (key === 'global' ? 10000 : 600))
      throw fail(429, 'Address suggestion limit reached. You can enter the address manually.');
  }
  keys.forEach(key => {const value = limits.get(key); value.minute++; value.hour++;});
}
function validate(input) {
  if (!input || typeof input.sessionToken !== 'string' || !UUID.test(input.sessionToken) || typeof input.zip !== 'string' || !/^\d{5}$/.test(input.zip))
    throw fail(400, 'Enter a valid ZIP and start a new address search');
}
async function request(method, path, body, params, fields) {
  if (!enabled()) throw fail(503, 'Address suggestions are unavailable. You can enter the address manually.');
  try {
    const {data} = await axios({method, url: 'https://places.googleapis.com/v1/' + path, data: body, params,
      headers: {'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': fields},
      timeout: 6000, maxRedirects: 0, maxContentLength: 150000, maxBodyLength: 10000});
    return data;
  } catch (_) {
    // Axios errors contain the credential-bearing request configuration.
    throw fail(503, 'Address suggestions are unavailable. You can enter the address manually.');
  }
}
async function autocomplete(userId, input) {
  validate(input);
  if (typeof input.input !== 'string' || input.input.trim().length < 3 || input.input.length > 200)
    throw fail(400, 'Enter at least 3 characters of your street address');
  admit(userId);
  const key = `${userId}:${input.sessionToken}`;
  let session = sessions.get(key);
  if (session && (session.closed || session.zip !== input.zip)) throw fail(409, 'Start a new address search');
  if (!session) {
    if (sessions.size >= 2000) throw fail(429, 'Address suggestions are busy. You can enter the address manually.');
    session = {started: Date.now(), zip: input.zip, providerToken: randomUUID(), placeIds: new Set(), closed: false};
    sessions.set(key, session);
  }
  const location = await addresses.lookupZip(input.zip), center = location.places[0];
  const hasCenter = Number.isFinite(center?.latitude) && Number.isFinite(center?.longitude);
  const data = await request('POST', 'places:autocomplete', {
    input: input.input.trim() + (hasCenter ? '' : `, ${input.zip}, USA`),
    includedRegionCodes: ['us'], includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route'],
    languageCode: 'en', regionCode: 'us', sessionToken: session.providerToken,
    ...(hasCenter ? {locationBias: {circle: {center: {latitude: center.latitude, longitude: center.longitude}, radius: 20000}}} : {})
  }, undefined, 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat');
  const suggestions = (data.suggestions || []).flatMap(item => {
    const p = item.placePrediction;
    if (!p || !/^[A-Za-z0-9_-]{1,255}$/.test(p.placeId) || !p.structuredFormat?.mainText?.text) return [];
    return [{placeId: p.placeId, mainText: String(p.structuredFormat.mainText.text).slice(0,250), secondaryText: String(p.structuredFormat.secondaryText?.text || '').slice(0,250)}];
  }).slice(0,5);
  if (!session.closed) for (const p of suggestions) {
    if (session.placeIds.size >= 100) session.placeIds.delete(session.placeIds.values().next().value);
    session.placeIds.add(p.placeId);
  }
  return {suggestions};
}
function parseAddress(data) {
  const parts = Array.isArray(data.addressComponents) ? data.addressComponents : [];
  const part = (type, short = false) => {const p = parts.find(x => x.types?.includes(type)); return String((short ? p?.shortText : p?.longText) || '').trim();};
  const state = part('administrative_area_level_1', true), zip = part('postal_code');
  const number = part('street_number'), route = part('route', true);
  const city = part('locality') || part('postal_town') || part('sublocality_level_1') || part('administrative_area_level_3');
  if (part('country', true) !== 'US' || !STATES.has(state) || !/^\d{5}$/.test(zip) || !route || !city)
    throw fail(422, 'This suggestion is missing delivery details. Please enter your address manually.');
  const unit = part('subpremise');
  return {address: {line1: [number, route].filter(Boolean).join(' ').slice(0,200), line2: unit ? `Unit ${unit}`.slice(0,200) : '', city: city.slice(0,100), state, postal_code: zip, country: 'US'}, missingStreetNumber: !number};
}
async function details(userId, input) {
  validate(input); admit(userId);
  const session = sessions.get(`${userId}:${input.sessionToken}`);
  if (!session || session.closed || session.zip !== input.zip || !session.placeIds.has(input.placeId))
    throw fail(409, 'This suggestion expired. Please search for your address again.');
  session.closed = true; // A Details request ends this billing session, even on failure.
  const data = await request('GET', 'places/' + encodeURIComponent(input.placeId), undefined,
    {sessionToken: session.providerToken, languageCode: 'en', regionCode: 'us'}, 'addressComponents');
  return parseAddress(data);
}
module.exports = {enabled, autocomplete, details, parseAddress};
