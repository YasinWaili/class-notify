import * as cheerio from "cheerio";

const BASE_URL = "https://central.carleton.ca/prod";
const TERM_URL = `${BASE_URL}/bwysched.p_select_term?wsea_code=EXT`;
const SEARCH_FIELDS_URL = `${BASE_URL}/bwysched.p_search_fields`;
const COURSE_SEARCH_URL = `${BASE_URL}/bwysched.p_course_search`;

const OPEN_STATUSES = new Set(["open", "waitlist open"]);

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getSessionId(html) {
  const $ = cheerio.load(html);
  const sessionId = $('input[name="session_id"]').first().attr("value");

  if (!sessionId) {
    throw new Error("Carleton schedule page did not include a session_id.");
  }

  return sessionId;
}

async function postForm(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "class-notify/0.1 (+https://github.com/YasinWaili/class-notify)"
    },
    body
  });

  const html = await response.text();

  if (!response.ok) {
    throw new Error(`Carleton schedule returned HTTP ${response.status}: ${cleanText(html).slice(0, 240)}`);
  }

  return html;
}

export async function fetchTerms() {
  const response = await fetch(TERM_URL, {
    headers: {
      "user-agent": "class-notify/0.1 (+https://github.com/YasinWaili/class-notify)"
    }
  });

  const html = await response.text();

  if (!response.ok) {
    throw new Error(`Could not fetch Carleton terms. HTTP ${response.status}`);
  }

  const $ = cheerio.load(html);

  return $('select[name="term_code"] option').map((_, option) => ({
    code: $(option).attr("value"),
    label: cleanText($(option).text()),
    selected: $(option).attr("selected") !== undefined
  })).get();
}

async function fetchSearchPage(termCode) {
  const termResponse = await fetch(TERM_URL, {
    headers: {
      "user-agent": "class-notify/0.1 (+https://github.com/YasinWaili/class-notify)"
    }
  });
  const termHtml = await termResponse.text();

  if (!termResponse.ok) {
    throw new Error(`Could not start Carleton schedule session. HTTP ${termResponse.status}`);
  }

  const body = new URLSearchParams();
  body.append("wsea_code", "EXT");
  body.append("session_id", getSessionId(termHtml));
  body.append("term_code", termCode);

  return postForm(SEARCH_FIELDS_URL, body.toString());
}

function buildCourseSearchBody({ termCode, sessionId, subject, number }) {
  const body = new URLSearchParams();

  body.append("wsea_code", "EXT");
  body.append("term_code", termCode);
  body.append("session_id", sessionId);
  body.append("ws_numb", "");

  for (const name of [
    "sel_aud",
    "sel_subj",
    "sel_camp",
    "sel_sess",
    "sel_attr",
    "sel_levl",
    "sel_schd",
    "sel_insm",
    "sel_link",
    "sel_wait",
    "sel_day",
    "sel_begin_hh",
    "sel_begin_mi",
    "sel_begin_am_pm",
    "sel_end_hh",
    "sel_end_mi",
    "sel_end_am_pm",
    "sel_instruct",
    "sel_special",
    "sel_resd",
    "sel_breadth"
  ]) {
    body.append(name, "dummy");
  }

  body.append("sel_levl", "");
  body.append("sel_subj", subject.toUpperCase());
  body.append("sel_number", String(number));
  body.append("sel_crn", "");
  body.append("sel_special", "N");

  for (const name of ["sel_sess", "sel_schd", "sel_insm", "sel_link", "sel_wait", "sel_camp", "sel_attr", "sel_resd", "sel_breadth"]) {
    body.append(name, "");
  }

  body.append("sel_begin_hh", "0");
  body.append("sel_begin_mi", "0");
  body.append("sel_begin_am_pm", "a");
  body.append("sel_end_hh", "0");
  body.append("sel_end_mi", "0");
  body.append("sel_end_am_pm", "a");

  for (const day of ["m", "t", "w", "r", "f", "s", "u"]) {
    body.append("sel_day", day);
  }

  body.append("block_button", "");

  return body.toString();
}

export function parseCourseResults(html) {
  const $ = cheerio.load(html);
  const sections = [];

  $("tr").each((_, row) => {
    const cells = $(row).children("td");

    if (cells.length < 11) {
      return;
    }

    const subject = cleanText(cells.eq(3).text());
    const crn = cleanText(cells.eq(2).text());

    if (!/^[A-Z]{3,4}\s+\d{4}[A-Z]?$/.test(subject) || !/^\d{5}$/.test(crn)) {
      return;
    }

    const status = cleanText(cells.eq(1).text());
    const section = cleanText(cells.eq(4).text());
    const title = cleanText(cells.eq(5).text());

    const details = [];
    let next = $(row).next();
    while (next.length && next.children("td").length < 11) {
      const detail = cleanText(next.text());
      if (detail) {
        details.push(detail);
      }
      next = next.next();
    }

    sections.push({
      status,
      isOpen: OPEN_STATUSES.has(status.toLowerCase()),
      crn,
      subject,
      section,
      title,
      credits: cleanText(cells.eq(6).text()),
      schedule: cleanText(cells.eq(7).text()),
      restrictions: cleanText(cells.eq(8).text()),
      prerequisites: cleanText(cells.eq(9).text()),
      instructor: cleanText(cells.eq(10).text()),
      details
    });
  });

  return sections;
}

export async function searchCourse({ termCode, subject, number }) {
  const searchPageHtml = await fetchSearchPage(termCode);
  const sessionId = getSessionId(searchPageHtml);
  const body = buildCourseSearchBody({ termCode, sessionId, subject, number });
  const resultHtml = await postForm(COURSE_SEARCH_URL, body);

  return parseCourseResults(resultHtml);
}

export function summarizeMatch(monitor, sections) {
  const wantedSection = String(monitor.section || "").trim().toUpperCase();
  const matches = sections.filter((section) => {
    if (!wantedSection) {
      return true;
    }

    return section.section.toUpperCase() === wantedSection;
  });

  return {
    matches,
    openMatches: matches.filter((section) => section.isOpen),
    checkedAt: new Date().toISOString()
  };
}
