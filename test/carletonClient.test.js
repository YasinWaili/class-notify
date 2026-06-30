import test from "node:test";
import assert from "node:assert/strict";
import { parseCourseResults } from "../src/lib/carletonClient.js";
import { normalizePhoneNumber } from "../src/lib/phone.js";

test("parseCourseResults extracts sections and open status", () => {
  const html = `
    <table>
      <tr>
        <td>&nbsp;</td>
        <td><font color="red">Full, No Waitlist</font></td>
        <td><a>21171</a></td>
        <td><a>PHYS 1902</a></td>
        <td>V</td>
        <td><a>From Our Star to the Cosmos</a></td>
        <td>.5</td>
        <td>Lecture</td>
        <td>No</td>
        <td>No</td>
        <td>Razieh Enjilela</td>
      </tr>
      <tr><td>&nbsp;</td><td colspan="10"><b>Meeting Date:</b> Jul 02, 2026 to Aug 14, 2026</td></tr>
      <tr>
        <td>&nbsp;</td>
        <td>Waitlist Open</td>
        <td><a>21172</a></td>
        <td><a>PHYS 2903</a></td>
        <td>R</td>
        <td><a>Physics Towards the Future</a></td>
        <td>.5</td>
        <td>Lecture</td>
        <td>Yes</td>
        <td>No</td>
        <td>Razieh Enjilela</td>
      </tr>
    </table>
  `;

  const results = parseCourseResults(html);

  assert.equal(results.length, 2);
  assert.equal(results[0].status, "Full, No Waitlist");
  assert.equal(results[0].isOpen, false);
  assert.equal(results[1].status, "Waitlist Open");
  assert.equal(results[1].isOpen, true);
  assert.equal(results[1].section, "R");
});

test("normalizePhoneNumber formats common North American numbers for Twilio", () => {
  assert.equal(normalizePhoneNumber("18732880566"), "+18732880566");
  assert.equal(normalizePhoneNumber("873-288-0566"), "+18732880566");
  assert.equal(normalizePhoneNumber("+1 (873) 288-0566"), "+18732880566");
  assert.equal(normalizePhoneNumber(""), "");
});
