# class-notify

Monitor Carleton University's public class schedule and notify you when a watched section changes to `Open` or `Waitlist Open`.

## What it checks

The app uses Carleton's public schedule pages, starting at:

https://central.carleton.ca/prod/bwysched.p_select_term?wsea_code=EXT

The site is an old HTML form flow:

1. Fetch the term page and read the generated `session_id`.
2. Post the chosen `term_code` to `bwysched.p_search_fields`.
3. Post a browser-style course search body to `bwysched.p_course_search`.
4. Parse the result rows and treat `Open` and `Waitlist Open` as available.

Closed statuses such as `Full, No Waitlist`, `Registration Closed`, and `Waitlist Full` are recorded but do not trigger notifications.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000 and add the courses you want to watch.

For your current examples:

- Summer 2026, `PHYS 1902`, section `V`
- Summer 2026, `PHYS 2903`, section `R`

## Notifications

Email uses SMTP settings from `.env`. SMS uses Twilio settings from `.env`.

If notification credentials are missing, the app logs the message it would have sent instead. That makes it possible to test course monitoring before wiring up secrets.

## Commands

```bash
npm start       # run the server
npm run dev     # run the server with node --watch
npm run check   # check all saved monitors once
npm test        # parser tests
```
