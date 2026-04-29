import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showField, hideField } from '../core/utils.js';
import { getCurrentCountry, getCurrentUser, setCurrentCountry } from '../core/state.js';
import { db } from '../services/firebase.js';
import { openNoteModalForCountry } from './notes.js';

let listenersBound = false;

export function initExplore() {
  if (listenersBound) return;
  listenersBound = true;

  document.getElementById('search-btn')?.addEventListener('click', () => searchCountryByInput());
  
  const countryInput = document.getElementById('country-input');
  if (countryInput) {
    countryInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        hideAutocomplete();
        searchCountryByInput();
      }
    });

    countryInput.addEventListener('input', (event) => {
      handleAutocomplete(event.target.value);
    });

    countryInput.addEventListener('focus', (event) => {
      handleAutocomplete(event.target.value);
    });
  }

  // Use event delegation for dynamic quick chips
  document.getElementById('quick-chips-container')?.addEventListener('click', (event) => {
    const chip = event.target.closest('.quick-chip[data-quick]');
    if (chip) {
      const country = chip.dataset.quick;
      if (country) searchCountryByName(country);
      return;
    }

    if (event.target.closest('#random-btn')) {
      event.preventDefault();
      searchRandomCountry();
    }
  });

  randomizeQuickChips();

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;

    // Hide autocomplete if clicking outside
    if (!event.target.closest('.search-wrap')) {
      hideAutocomplete();
    }

    if (event.target.closest('[data-add-note-explore]')) {
      const country = getCurrentCountry();
      if (country) openNoteModalForCountry(country.name.common);
      return;
    }

    const borderButton = event.target.closest('[data-border-code]');
    if (borderButton instanceof HTMLElement) {
      searchCountryByCode(borderButton.dataset.borderCode);
    }
  });
}

export function renderExploreSection() {
  const user = getCurrentUser();
  const exploreHero = document.querySelector('.explore-hero');

  // Only update if the explore hero is actually visible (the user has clicked "Start Exploring")
  if (!exploreHero || exploreHero.style.display === 'none') return;

  randomizeQuickChips();

  if (!user) {
    renderExploreLogin();
  } else {
    // If user just logged in and we were showing the locked prompt, clear it
    const loginPrompt = document.getElementById('explore-login-btn');
    if (loginPrompt) {
      document.getElementById('explore-result').innerHTML = '';
      document.getElementById('explore-result').style.display = 'none';
      setTimeout(() => {
        document.getElementById('country-input')?.focus();
      }, 100);
    }
  }
}

function checkAuth() {
  const user = getCurrentUser();
  if (!user) {
    renderExploreLogin();
    return false;
  }
  return true;
}

export function renderExploreLogin() {
  const resultWrapper = document.querySelector('.result-wrapper');
  if (!resultWrapper) return;

  resultWrapper.style.display = 'block';
  document.getElementById('explore-result').style.display = 'none';
  document.getElementById('explore-loading').style.display = 'none';

  document.getElementById('explore-result').innerHTML = `
    <div class="card" style="max-width:600px; margin: 2rem auto;">
      <div class="card-body">
        <div class="empty-state">
          <h3>Sign in to Explore</h3>
          <p>You need to be signed in to search countries, view live weather, and see Wikipedia summaries.</p>
          <button class="btn btn-primary empty-state-action" id="explore-login-btn">Sign In Now</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('explore-result').style.display = 'block';

  document.getElementById('explore-login-btn')?.addEventListener('click', () => {
    document.getElementById('nav-login-btn')?.click();
  });

  // Also clear any previous error
  hideField('explore-error');
}

export async function searchCountryByInput() {
  if (!checkAuth()) return;
  const query = document.getElementById('country-input')?.value.trim();
  if (!query) {
    showField('explore-error', 'Please enter a country name.');
    return;
  }
  await searchCountryByName(query);
}

export async function searchCountryByName(query) {
  if (!checkAuth()) return;
  const input = document.getElementById('country-input');
  if (input) input.value = query;

  hideField('explore-error');
  setLoadingState(true);

  // Clear previous result before starting a new search
  const resultEl = document.getElementById('explore-result');
  const hero = document.querySelector('.explore-hero');
  if (hero) hero.classList.remove('has-results');

  if (resultEl) {
    resultEl.innerHTML = '';
    resultEl.style.display = 'none';
  }

  try {
    const country = await fetchCountryByName(query);
    await displayCountry(country);
    setLoadingState(false, true);
  } catch (error) {
    console.error('Explore error:', error);
    setLoadingState(false, false);
    
    // Attempt to find suggestions if no match was found
    const suggestions = findSuggestions(query);
    let message = error.message || 'Could not find that country.';
    
    const errorEl = document.getElementById('explore-error');
    if (errorEl) {
      errorEl.style.display = 'block';
      if (suggestions.length > 0) {
        const suggestionHtml = suggestions
          .map(s => `<button class="error-suggestion-link" onclick="window.__exploreSearch('${s.replace(/'/g, "\\'")}')">${s}</button>`)
          .join(', ');
        errorEl.innerHTML = `❌ ${message} <br/><span class="error-suggestion-note">Did you mean: ${suggestionHtml}?</span>`;
      } else {
        errorEl.textContent = `❌ ${message} Please check the spelling or try a different name.`;
      }
    }
  }
}

// Global hook for suggestion clicks
window.__exploreSearch = (name) => {
  searchCountryByName(name);
};

async function searchRandomCountry() {
  if (!checkAuth()) return;
  hideField('explore-error');
  setLoadingState(true);

  // Clear previous result
  const resultEl = document.getElementById('explore-result');
  const hero = document.querySelector('.explore-hero');
  if (hero) hero.classList.remove('has-results');

  if (resultEl) {
    resultEl.innerHTML = '';
    resultEl.style.display = 'none';
  }

  try {
    const country = await fetchRandomCountry();
    const input = document.getElementById('country-input');
    if (input) input.value = country.name?.common || '';

    await displayCountry(country);
    setLoadingState(false, true);
  } catch (error) {
    console.error('Random country error:', error);
    setLoadingState(false, false);
    const message = error.message || 'Could not load a random country. Please try again.';
    showField('explore-error', `❌ ${message}`);
  }
}

async function searchCountryByCode(code) {
  if (!checkAuth()) return;
  if (!code) return;

  hideField('explore-error');
  setLoadingState(true);

  const resultEl = document.getElementById('explore-result');
  const hero = document.querySelector('.explore-hero');

  if (hero) hero.classList.remove('has-results');

  if (resultEl) {
    resultEl.innerHTML = '';
    resultEl.style.display = 'none';
  }

  try {
    const country = await fetchCountryByCode(code);

    const input = document.getElementById('country-input');
    if (input) input.value = country.name?.common || code;

    await displayCountry(country);

    setLoadingState(false, true);
  } catch (error) {
    console.error('Border country error:', error);
    setLoadingState(false, false);
    showField('explore-error', 'Could not load that neighboring country.');
  }
}

// ─── Fetch with timeout ───────────────────────────────────────────────────────
// Aborts the request after `timeoutMs` so a dead API never hangs the UI.
async function fetchWithTimeout(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Common country name → cca2 for instant reliable lookups (avoids API unpredictability)
const COMMON_CODES = {
  'afghanistan': 'AF', 'albania': 'AL', 'algeria': 'DZ', 'argentina': 'AR', 'australia': 'AU',
  'austria': 'AT', 'bangladesh': 'BD', 'belgium': 'BE', 'bolivia': 'BO', 'brazil': 'BR',
  'cambodia': 'KH', 'canada': 'CA', 'chile': 'CL', 'china': 'CN', 'colombia': 'CO',
  'croatia': 'HR', 'cuba': 'CU', 'czech republic': 'CZ', 'czechia': 'CZ', 'denmark': 'DK',
  'ecuador': 'EC', 'egypt': 'EG', 'ethiopia': 'ET', 'finland': 'FI', 'france': 'FR',
  'germany': 'DE', 'ghana': 'GH', 'greece': 'GR', 'guatemala': 'GT', 'hungary': 'HU',
  'india': 'IN', 'indonesia': 'ID', 'iran': 'IR', 'iraq': 'IQ', 'ireland': 'IE',
  'israel': 'IL', 'italy': 'IT', 'jamaica': 'JM', 'japan': 'JP', 'jordan': 'JO',
  'kenya': 'KE', 'south korea': 'KR', 'north korea': 'KP', 'kuwait': 'KW',
  'laos': 'LA', 'lebanon': 'LB', 'libya': 'LY', 'malaysia': 'MY', 'mexico': 'MX',
  'morocco': 'MA', 'mozambique': 'MZ', 'myanmar': 'MM', 'nepal': 'NP', 'netherlands': 'NL',
  'new zealand': 'NZ', 'nigeria': 'NG', 'norway': 'NO', 'pakistan': 'PK', 'panama': 'PA',
  'peru': 'PE', 'philippines': 'PH', 'poland': 'PL', 'portugal': 'PT', 'qatar': 'QA',
  'romania': 'RO', 'russia': 'RU', 'saudi arabia': 'SA', 'senegal': 'SN', 'serbia': 'RS',
  'singapore': 'SG', 'somalia': 'SO', 'south africa': 'ZA', 'spain': 'ES', 'sri lanka': 'LK',
  'sudan': 'SD', 'sweden': 'SE', 'switzerland': 'CH', 'syria': 'SY', 'taiwan': 'TW',
  'tanzania': 'TZ', 'thailand': 'TH', 'turkey': 'TR', 'ukraine': 'UA',
  'united arab emirates': 'AE', 'uae': 'AE', 'united kingdom': 'GB', 'uk': 'GB',
  'united states': 'US', 'usa': 'US', 'united states of america': 'US',
  'uruguay': 'UY', 'venezuela': 'VE', 'vietnam': 'VN', 'yemen': 'YE', 'zambia': 'ZM',
  'zimbabwe': 'ZW',
};

const BACKUP_COUNTRIES_URL = '/backup/countries.json';
let _backupCountriesCache = null;

// CCA3 → CCA2 local lookup — avoids an API round-trip for border code conversion
const CCA3_TO_CCA2 = {
  'AFG':'AF','ALB':'AL','DZA':'DZ','AND':'AD','AGO':'AO','ATG':'AG','ARG':'AR','ARM':'AM','AUS':'AU','AUT':'AT','AZE':'AZ',
  'BHS':'BS','BHR':'BH','BGD':'BD','BRB':'BB','BLR':'BY','BEL':'BE','BLZ':'BZ','BEN':'BJ','BTN':'BT','BOL':'BO','BIH':'BA',
  'BWA':'BW','BRA':'BR','BRN':'BN','BGR':'BG','BFA':'BF','BDI':'BI','CPV':'CV','KHM':'KH','CMR':'CM','CAN':'CA','CAF':'CF',
  'TCD':'TD','CHL':'CL','CHN':'CN','COL':'CO','COM':'KM','COD':'CD','COG':'CG','CRI':'CR','CIV':'CI','HRV':'HR','CUB':'CU',
  'CYP':'CY','CZE':'CZ','DNK':'DK','DJI':'DJ','DMA':'DM','DOM':'DO','ECU':'EC','EGY':'EG','SLV':'SV','GNQ':'GQ','ERI':'ER',
  'EST':'EE','SWZ':'SZ','ETH':'ET','FJI':'FJ','FIN':'FI','FRA':'FR','GAB':'GA','GMB':'GM','GEO':'GE','DEU':'DE','GHA':'GH',
  'GRC':'GR','GRD':'GD','GTM':'GT','GIN':'GN','GNB':'GW','GUY':'GY','HTI':'HT','HND':'HN','HUN':'HU','ISL':'IS','IND':'IN',
  'IDN':'ID','IRN':'IR','IRQ':'IQ','IRL':'IE','ISR':'IL','ITA':'IT','JAM':'JM','JPN':'JP','JOR':'JO','KAZ':'KZ','KEN':'KE',
  'KIR':'KI','PRK':'KP','KOR':'KR','KWT':'KW','KGZ':'KG','LAO':'LA','LVA':'LV','LBN':'LB','LSO':'LS','LBR':'LR','LBY':'LY',
  'LIE':'LI','LTU':'LT','LUX':'LU','MDG':'MG','MWI':'MW','MYS':'MY','MDV':'MV','MLI':'ML','MLT':'MT','MHL':'MH','MRT':'MR',
  'MUS':'MU','MEX':'MX','FSM':'FM','MDA':'MD','MCO':'MC','MNG':'MN','MNE':'ME','MAR':'MA','MOZ':'MZ','MMR':'MM','NAM':'NA',
  'NRU':'NR','NPL':'NP','NLD':'NL','NZL':'NZ','NIC':'NI','NER':'NE','NGA':'NG','MKD':'MK','NOR':'NO','OMN':'OM','PAK':'PK',
  'PLW':'PW','PSE':'PS','PAN':'PA','PNG':'PG','PRY':'PY','PER':'PE','PHL':'PH','POL':'PL','PRT':'PT','QAT':'QA','ROU':'RO',
  'RUS':'RU','RWA':'RW','KNA':'KN','LCA':'LC','VCT':'VC','WSM':'WS','SMR':'SM','STP':'ST','SAU':'SA','SEN':'SN','SRB':'RS',
  'SYC':'SC','SLE':'SL','SGP':'SG','SVK':'SK','SVN':'SI','SLB':'SB','SOM':'SO','ZAF':'ZA','SSD':'SS','ESP':'ES','LKA':'LK',
  'SDN':'SD','SUR':'SR','SWE':'SE','CHE':'CH','SYR':'SY','TWN':'TW','TJK':'TJ','TZA':'TZ','THA':'TH','TLS':'TL','TGO':'TG',
  'TON':'TO','TTO':'TT','TUN':'TN','TUR':'TR','TKM':'TM','TUV':'TV','UGA':'UG','UKR':'UA','ARE':'AE','GBR':'GB','USA':'US',
  'URY':'UY','UZB':'UZ','VUT':'VU','VEN':'VE','VNM':'VN','YEM':'YE','ZMB':'ZM','ZWE':'ZW','VAT':'VA','XKX':'XK'
};

async function loadBackupCountries() {
  if (_backupCountriesCache) return _backupCountriesCache;
  try {
    const response = await fetch(BACKUP_COUNTRIES_URL);
    if (!response.ok) throw new Error(`Backup countries failed (${response.status})`);
    _backupCountriesCache = await response.json();
    return _backupCountriesCache;
  } catch (error) {
    console.error('Backup countries load failed:', error);
    return null;
  }
}

const ALL_COUNTRY_NAMES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi',
  'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czechia',
  'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia',
  'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast',
  'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway',
  'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
  'Yemen', 'Zambia', 'Zimbabwe'
];

function handleAutocomplete(query) {
  const suggestionsEl = document.getElementById('search-suggestions');
  if (!suggestionsEl) return;

  const key = query.trim().toLowerCase();
  if (key.length < 1) {
    hideAutocomplete();
    return;
  }

  const matches = ALL_COUNTRY_NAMES
    .filter(name => name.toLowerCase().includes(key))
    .sort((a, b) => {
      // Prioritize startsWith
      const aStarts = a.toLowerCase().startsWith(key);
      const bStarts = b.toLowerCase().startsWith(key);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    })
    .slice(0, 5);

  if (matches.length === 0) {
    hideAutocomplete();
    return;
  }

  suggestionsEl.innerHTML = matches
    .map(name => `<div class="suggestion-item" onclick="window.__selectSuggestion('${name.replace(/'/g, "\\'")}')">${name}</div>`)
    .join('');
  
  suggestionsEl.style.display = 'block';
}

function hideAutocomplete() {
  const suggestionsEl = document.getElementById('search-suggestions');
  if (suggestionsEl) suggestionsEl.style.display = 'none';
}

window.__selectSuggestion = (name) => {
  const input = document.getElementById('country-input');
  if (input) input.value = name;
  hideAutocomplete();
  searchCountryByName(name);
};

function findSuggestions(query) {
  const key = query.toLowerCase().trim();
  if (key.length < 2) return [];

  // 1. Find countries that start with the query
  let matches = ALL_COUNTRY_NAMES.filter(name => name.toLowerCase().startsWith(key));

  // 2. If few matches, find countries that contain the query
  if (matches.length < 3) {
    const contains = ALL_COUNTRY_NAMES.filter(name => 
      !matches.includes(name) && name.toLowerCase().includes(key)
    );
    matches = [...matches, ...contains];
  }

  // 3. If still few, try very simple fuzzy (shared characters overlap)
  if (matches.length < 2) {
    const fuzzy = ALL_COUNTRY_NAMES
      .map(name => {
        const n = name.toLowerCase();
        let score = 0;
        for (let i = 0; i < key.length; i++) {
          if (n.includes(key[i])) score++;
        }
        return { name, score: score / Math.max(name.length, key.length) };
      })
      .filter(item => item.score > 0.4)
      .sort((a, b) => b.score - a.score)
      .map(item => item.name);
    
    matches = [...new Set([...matches, ...fuzzy])];
  }

  return matches.slice(0, 3);
}

async function fetchBackupCountryByName(query) {
  const countries = await loadBackupCountries();
  if (!countries) return null;
  const key = query.trim().toLowerCase();
  return countries.find((c) => {
    const common = c.name?.common?.toLowerCase();
    const official = c.name?.official?.toLowerCase();
    const native = Object.values(c.name?.nativeName || {}).some((n) => {
      const nCommon = n?.common?.toLowerCase();
      const nOfficial = n?.official?.toLowerCase();
      return nCommon === key || nOfficial === key;
    });
    return common === key || official === key || native;
  });
}

async function fetchBackupCountryByCode(code) {
  const countries = await loadBackupCountries();
  if (!countries) return null;
  const upperCode = code.toUpperCase();
  return countries.find(
    (c) => c.cca2 === upperCode || c.cca3 === upperCode || c.ccn3 === upperCode || c.cioc === upperCode
  );
}

async function fetchCountryByName(query) {
  const key = query.trim().toLowerCase();

  // Fast path: if it's a well-known country, skip the name search and go straight to code
  if (COMMON_CODES[key]) {
    return fetchCountryByCode(COMMON_CODES[key]);
  }

  // Use Countries Now API for search
  try {
    const response = await fetchWithTimeout('https://countriesnow.space/api/v0.1/countries/codes', 5000);
    if (!response.ok) throw new Error(`Country lookup failed (${response.status})`);

    const data = await response.json();
    if (!data.error && data.data) {
      const country = data.data.find(c =>
        c.name.toLowerCase().includes(key) ||
        c.code.toLowerCase() === key
      );

      if (country) {
        return fetchCountryByCode(country.code);
      }
    }
  } catch (error) {
    console.error('Countries Now API failed:', error);
  }

  // Fallback to REST Countries with timeout
  try {
    const res = await fetchWithTimeout(`https://restcountries.com/v3.1/name/${encodeURIComponent(query)}`, 4000);
    let country = null;

    if (res.status === 404) {
      country = await fetchBackupCountryByName(query);
      if (country) return country;
      throw new Error(`Country not found: "${query}"`);
    }

    if (res.status === 502) {
      country = await fetchBackupCountryByName(query);
      if (country) return country;
      throw new Error(`The country data service is temporarily unavailable. Please try again later.`);
    }

    if (!res.ok) {
      country = await fetchBackupCountryByName(query);
      if (country) return country;
      throw new Error(`Country lookup failed (${res.status})`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      country = await fetchBackupCountryByName(query);
      if (country) return country;
      throw new Error(`Country not found: "${query}"`);
    }

    const exact = data.find(
      c => c.name?.common?.toLowerCase() === key ||
        c.name?.official?.toLowerCase() === key
    );
    return exact || data[0];
  } catch (error) {
    // REST Countries timed out — try backup
    if (error.name === 'AbortError' || error.message?.includes('timed out')) {
      console.warn('REST Countries timed out for name search, trying backup');
      const backup = await fetchBackupCountryByName(query);
      if (backup) return backup;
    }
    throw error;
  }
}

async function fetchCountryByCode(code) {
  let upperCode = code.toUpperCase();

  // Convert CCA3 → CCA2 using local lookup first (instant, no API call)
  if (upperCode.length === 3) {
    const mapped = CCA3_TO_CCA2[upperCode];
    if (mapped) {
      upperCode = mapped;
    } else {
      // Only hit REST Countries for CCA3→CCA2 if not in our local map
      try {
        const res = await fetchWithTimeout(`https://restcountries.com/v3.1/alpha/${upperCode}`, 3000);
        if (res.ok) {
          const data = await res.json();
          const country = Array.isArray(data) ? data[0] : data;
          if (country?.cca2) upperCode = country.cca2;
        }
      } catch (e) {
        console.warn('CCA3→CCA2 via REST Countries failed, continuing with:', upperCode);
      }
    }
  }

  // Fetch Countries Now metadata in parallel (positions + codes + info)
  let codesData = null, positionsData = null, infoData = null;

  try {
    const [codesRes, positionsRes, infoRes] = await Promise.all([
      fetchWithTimeout('https://countriesnow.space/api/v0.1/countries/codes', 5000),
      fetchWithTimeout('https://countriesnow.space/api/v0.1/countries/positions', 5000),
      fetchWithTimeout('https://countriesnow.space/api/v0.1/countries/info?returns=name,flag,unicodeFlag,currency,capital,population,iso2', 5000),
    ]);

    if (codesRes.ok) codesData = await codesRes.json();
    if (positionsRes.ok) positionsData = await positionsRes.json();
    if (infoRes.ok) infoData = await infoRes.json();
  } catch (e) {
    console.warn('Countries Now fetch partially failed:', e);
  }

  const codeInfo = codesData?.data?.find(c => c.code === upperCode);
  const positionInfo = positionsData?.data?.find(c => c.iso2 === upperCode);
  const basicInfo = infoData?.data?.find(c => c.iso2 === upperCode);

  // Try REST Countries with a short timeout — best data source when available
  try {
    const restRes = await fetchWithTimeout(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(upperCode)}`, 4000);
    if (restRes.ok) {
      const restData = await restRes.json();
      const country = Array.isArray(restData) ? restData[0] : restData;
      if (country) {
        // Patch latlng from Countries Now if missing
        if ((!Array.isArray(country.latlng) || country.latlng.length === 0) && positionInfo) {
          country.latlng = [positionInfo.lat, positionInfo.long];
        }
        return country;
      }
    }
  } catch (e) {
    console.warn('REST Countries timed out or failed, using Countries Now fallback');
  }

  // REST Countries failed — try static backup JSON
  const backupCountry = await fetchBackupCountryByCode(upperCode);
  if (backupCountry) {
    if ((!Array.isArray(backupCountry.latlng) || backupCountry.latlng.length === 0) && positionInfo) {
      backupCountry.latlng = [positionInfo.lat, positionInfo.long];
    }
    return backupCountry;
  }

  // Build a country object purely from Countries Now data (no REST Countries needed)
  if (codeInfo || basicInfo) {
    const name = codeInfo?.name || basicInfo?.name || upperCode;
    return {
      name: {
        common: name,
        official: name,
        nativeName: { default: { common: name, official: name } }
      },
      flags: {
        png: basicInfo?.flag || '',
        svg: basicInfo?.flag || '',
        alt: `${name} flag`
      },
      flag: basicInfo?.unicodeFlag || '',
      capital: basicInfo?.capital ? [basicInfo.capital] : ['N/A'],
      region: 'Unknown',
      subregion: 'Unknown',
      population: basicInfo?.population || 0,
      area: 0,
      latlng: positionInfo ? [positionInfo.lat, positionInfo.long] : [],
      borders: [],
      languages: {},
      currencies: basicInfo?.currency
        ? { [basicInfo.currency.toLowerCase()]: { name: basicInfo.currency, symbol: '' } }
        : {},
      timezones: ['UTC+00:00'],
      continents: ['Unknown'],
      car: { side: 'right' },
      fifa: upperCode,
      independent: true,
      unMember: true,
      coatOfArms: { svg: '', png: '' },
      maps: {
        googleMaps: positionInfo
          ? `https://www.google.com/maps?q=${positionInfo.lat},${positionInfo.long}`
          : '#',
        openStreetMaps: ''
      },
      cca2: upperCode,
      cca3: upperCode,
      ccn3: '',
      cioc: upperCode
    };
  }

  throw new Error(`Country not found: ${upperCode}`);
}

// Cache for random country codes — fetched once, reused forever
let _randomCountryCodes = null;
const FALLBACK_CODES = ['US', 'GB', 'FR', 'DE', 'JP', 'CN', 'IN', 'BR', 'AU', 'CA', 'RU', 'KR', 'MX', 'ZA', 'NG', 'EG', 'AR', 'ID', 'PK', 'BD', 'PH', 'VN', 'TH', 'TR', 'SA', 'AE', 'SG', 'MY', 'KE', 'TZ', 'GH', 'MA', 'ET', 'CM', 'CI', 'TN', 'DZ', 'LY', 'MZ', 'ZM', 'ZW', 'SN', 'SD', 'UG', 'AO', 'MG', 'ML', 'BF', 'NE', 'TD', 'SO', 'SS', 'RW', 'BI', 'MR', 'GM', 'GN', 'SL', 'LR', 'GW', 'CV', 'ST', 'CF', 'CG', 'CD', 'GA', 'GQ', 'ER', 'DJ', 'MU', 'SC', 'KM', 'NA', 'BW', 'LS', 'SZ'];

async function fetchRandomCountry() {
  // First call: try to fetch all country codes for max variety
  if (!_randomCountryCodes) {
    try {
      const response = await fetchWithTimeout('https://countriesnow.space/api/v0.1/countries/codes', 5000);
      if (response.ok) {
        const data = await response.json();
        if (!data.error && data.data) {
          _randomCountryCodes = data.data.map(c => c.code).filter(Boolean);
        }
      }
    } catch (_) { /* ignore */ }

    // Fallback to REST Countries with timeout
    if (!_randomCountryCodes || _randomCountryCodes.length === 0) {
      try {
        const response = await fetchWithTimeout('https://restcountries.com/v3.1/all?fields=cca2', 4000);

        if (response.ok) {
          const list = await response.json();
          if (Array.isArray(list) && list.length > 0) {
            _randomCountryCodes = list.map(c => c.cca2).filter(Boolean);
          }
        }
      } catch (_) { /* ignore */ }
    }

    // Final fallback to hardcoded list
    if (!_randomCountryCodes || _randomCountryCodes.length === 0) {
      _randomCountryCodes = FALLBACK_CODES;
    }
  }

  // Pick a random code and fetch full data for just that one country
  const code = _randomCountryCodes[Math.floor(Math.random() * _randomCountryCodes.length)];
  return fetchCountryByCode(code);
}

async function fetchWeather(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  try {
    const response = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure,is_day' +
      '&timezone=auto',
      6000
    );
    if (!response.ok) throw new Error(`Weather lookup failed with status ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Weather fetch failed:', error);
    return null;
  }
}

async function fetchWikiSummary(countryName) {
  try {
    const response = await fetchWithTimeout(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(countryName)}`,
      5000
    );
    if (!response.ok) throw new Error(`Wiki lookup failed with status ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Wiki fetch failed:', error);
    return null;
  }
}

async function displayCountry(country) {
  setCurrentCountry(country);

  const [weather, wiki] = await Promise.all([
    fetchWeather(country.latlng?.[0], country.latlng?.[1]),
    fetchWikiSummary(country.name.common)
  ]);

  renderCountryResult(country, weather, wiki);
  await saveExploreHistory(country.name.common);
}

function renderCountryResult(country, weather, wiki) {
  const resultEl = document.getElementById('explore-result');
  if (!resultEl) return;

  const commonName = country.name?.common || 'Unknown country';
  const officialName = country.name?.official || commonName;
  const nativeName = country.name?.nativeName ? Object.values(country.name.nativeName)[0].common : '';
  const flag = country.flags?.svg || country.flags?.png || '';
  const flagPng = country.flags?.png || '';
  const flagEmoji = country.flag || '';
  const capital = country.capital?.[0] || 'N/A';
  const population = country.population?.toLocaleString() || 'N/A';
  const area = country.area ? `${country.area.toLocaleString()} km2` : 'N/A';
  const region = country.region || 'N/A';
  const subregion = country.subregion || '';
  const languages = country.languages ? Object.values(country.languages).join(', ') : 'N/A';
  const currencies = country.currencies
    ? Object.values(country.currencies).map((currency) => `${currency.name}${currency.symbol ? ` (${currency.symbol})` : ''}`).join(', ')
    : 'N/A';
  const timezone = country.timezones?.[0] || 'N/A';
  const continent = country.continents?.[0] || region;
  const drivingSide = country.car?.side ? (country.car.side === 'left' ? 'Left side' : 'Right side') : 'N/A';
  const fifa = country.fifa || 'N/A';
  const independent = typeof country.independent === 'boolean' ? (country.independent ? 'Yes' : 'No') : 'N/A';
  const unMember = typeof country.unMember === 'boolean' ? (country.unMember ? 'Yes' : 'No') : 'N/A';
  const coatOfArms = country.coatOfArms?.svg || country.coatOfArms?.png || '';
  const borders = Array.isArray(country.borders) ? country.borders : [];
  const mapUrl = country.maps?.googleMaps || (country.latlng ? `https://www.google.com/maps?q=${country.latlng[0]},${country.latlng[1]}` : '#');

  const weatherHtml = weather?.current ? `
    <div class="weather-card">
      <div class="split-row">
        <div class="weather-info">
          <div class="weather-temp">${Math.round(weather.current.temperature_2m)}&deg;C</div>
          <div class="weather-desc">${escapeHtml(describeWeather(weather.current.weather_code))}</div>
        </div>
        <div class="weather-emoji">${escapeHtml(getWeatherIcon(weather.current.weather_code))}</div>
      </div>
      <div class="weather-stats">
        <span>${weather.current.is_day ? 'Daytime' : 'Nighttime'}</span>
        <span>${escapeHtml(weather.timezone || 'Local timezone')}</span>
      </div>
      <div class="weather-grid">
        <div class="weather-stat">
          <span class="ws-label">Feels Like</span>
          <span class="ws-val">${Math.round(weather.current.apparent_temperature)}&deg;C</span>
        </div>
        <div class="weather-stat">
          <span class="ws-label">Humidity</span>
          <span class="ws-val">${weather.current.relative_humidity_2m}%</span>
        </div>
        <div class="weather-stat">
          <span class="ws-label">Wind</span>
          <span class="ws-val">${Math.round(weather.current.wind_speed_10m)} km/h</span>
        </div>
        <div class="weather-stat">
          <span class="ws-label">Pressure</span>
          <span class="ws-val">${Math.round(weather.current.surface_pressure)} hPa</span>
        </div>
        <div class="weather-stat">
          <span class="ws-label">Capital</span>
          <span class="ws-val">${escapeHtml(capital)}</span>
        </div>
        <div class="weather-stat">
          <span class="ws-label">Region</span>
          <span class="ws-val">${escapeHtml(subregion || region)}</span>
        </div>
      </div>
    </div>
  ` : '<p class="support-copy">Weather unavailable for this location.</p>';

  const wikiHtml = wiki?.extract ? `
    <div class="card">
      <div class="card-body">
        <p class="card-title">About ${escapeHtml(commonName)}</p>
        <div class="wiki-summary">
          <p>${escapeHtml(wiki.extract)}</p>
          ${wiki.content_urls?.desktop?.page ? `<a href="${wiki.content_urls.desktop.page}" target="_blank" rel="noreferrer" class="wiki-link">Read more on Wikipedia</a>` : ''}
        </div>
      </div>
    </div>
  ` : `
    <div class="card">
      <div class="card-body">
        <p class="card-title">About ${escapeHtml(commonName)}</p>
        <div class="wiki-summary">
          <p>Wikipedia summary unavailable for this country right now.</p>
        </div>
      </div>
    </div>
  `;

  resultEl.innerHTML = `
    <div class="country-main">
      <div class="content-stack">
        <div class="card">
          <div class="card-body">
            <div class="country-hero-details">
              ${flag ? `<img src="${flag}" alt="${escapeHtml(commonName)} flag" class="country-card-flag" />` : `<div class="flag-emoji-fallback">${escapeHtml(flagEmoji)}</div>`}
              <div class="country-hero-info-side">
                <div class="country-hero-main">
                  <div class="country-hero-title">
                    <h2>${escapeHtml(commonName)}</h2>
                    <p class="country-hero-subtitle">${escapeHtml(nativeName ? `${officialName} · ${nativeName}` : officialName)}</p>
                  </div>
                </div>
                <div class="country-hero-actions">
                  <button class="btn btn-gold btn-sm" type="button" data-add-note-explore>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    Add Note
                  </button>
                  ${mapUrl !== '#' ? `<a href="${mapUrl}" target="_blank" rel="noreferrer" class="btn btn-ghost-map btn-sm">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    View on Map
                  </a>` : ''}
                </div>
              </div>
            </div>

            <p class="card-title">Core Information</p>
            <div class="info-grid">
              ${renderInfoItem('Capital', capital)}
              ${renderInfoItem('Population', population)}
              ${renderInfoItem('Currency', currencies)}
              ${renderInfoItem('Language', languages)}
              ${renderInfoItem('Area', area)}
              ${renderInfoItem('Code', country.cca2 || 'N/A')}
              ${renderInfoItem('Continent', continent)}
              ${renderInfoItem('Timezone', timezone)}
              ${renderInfoItem('Driving Side', drivingSide)}
              ${renderInfoItem('FIFA Code', fifa)}
              ${renderInfoItem('UN Member', unMember)}
              ${renderInfoItem('Independent', independent)}
            </div>
            ${coatOfArms ? `
              <div class="coat-of-arms">
                <img src="${coatOfArms}" alt="Coat of arms of ${escapeHtml(commonName)}" class="coat-of-arms-image" />
                <span class="meta-note">Coat of Arms</span>
              </div>
            ` : ''}
            ${borders.length ? `
              <div class="card-section">
                <p class="card-title card-title-tight">Bordering Countries <span class="card-title-subtle">(click to explore)</span></p>
                <div class="borders-wrap">
                  ${borders.map((code) => `<button class="border-tag border-tag-btn" type="button" data-border-code="${escapeHtml(code)}">${escapeHtml(code)}</button>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
        <div class="card">
          <div class="card-body">
            <p class="card-title">Live Weather — ${escapeHtml(capital)}</p>
            ${weatherHtml}
          </div>
        </div>
        ${wikiHtml}
      </div>
    </div>
  `;
}

async function saveExploreHistory(countryName) {
  const user = getCurrentUser();
  if (!user?.uid) return;

  try {
    await addDoc(collection(db, 'users', user.uid, 'history'), {
      country: countryName,
      type: 'explore',
      created: serverTimestamp()
    });
  } catch (error) {
    console.error('Save history error:', error);
  }
}

function setLoadingState(isLoading, hasResult = false) {
  const loadingEl = document.getElementById('explore-loading');
  const resultEl = document.getElementById('explore-result');
  const wrapper = document.querySelector('.result-wrapper');
  const hero = document.querySelector('.explore-hero');

  if (loadingEl) loadingEl.style.display = isLoading ? 'block' : 'none';
  if (resultEl) resultEl.style.display = hasResult ? 'block' : 'none';
  
  if (wrapper) {
    wrapper.style.display = (isLoading || hasResult) ? 'block' : 'none';
  }

  if (hasResult && hero) {
    hero.classList.add('has-results');
    setTimeout(() => {
      wrapper?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } else if (isLoading && hero) {
    wrapper?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function getWeatherIcon(code) {
  const icons = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
    45: '🌫️', 48: '🌫️',
    51: '🌦️', 53: '🌦️', 55: '🌧️',
    61: '🌧️', 63: '🌧️', 65: '🌧️',
    71: '❄️', 73: '❄️', 75: '❄️',
    95: '⛈️', 96: '⛈️', 99: '⛈️'
  };
  return icons[code] || '🌤️';
}

function describeWeather(code) {
  const descriptions = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Light rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Moderate snow', 75: 'Heavy snow',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Heavy thunderstorm with hail'
  };
  return descriptions[code] || 'Current conditions unavailable';
}

function randomizeQuickChips() {
  const container = document.getElementById('quick-chips-container');
  if (!container) return;

  const countryPool = [
    'Japan', 'Brazil', 'France', 'India', 'Kenya', 'Australia', 'Canada', 'Mexico',
    'Italy', 'Germany', 'Egypt', 'Thailand', 'Argentina', 'South Africa', 'Greece',
    'Spain', 'Norway', 'Iceland', 'Turkey', 'Peru', 'Vietnam', 'Singapore', 'Morocco',
    'Netherlands', 'Switzerland', 'New Zealand', 'Portugal', 'Sweden', 'Poland', 'Finland'
  ];

  const shuffled = [...countryPool].sort(() => 0.5 - Math.random()).slice(0, 6);

  const surpriseBtn = document.getElementById('random-btn');

  container.innerHTML = '';
  shuffled.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'quick-chip';
    btn.dataset.quick = name;
    btn.textContent = name;
    container.appendChild(btn);
  });

  if (surpriseBtn) container.appendChild(surpriseBtn);
}

function renderInfoItem(label, value) {
  return `
    <div class="info-item">
      <span class="lbl">${escapeHtml(label)}</span>
      <span class="val">${escapeHtml(value)}</span>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}