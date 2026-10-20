# Epic 8: Notifications

Epic issue: Excia/Guestrooms-Demo#77. Figma page: Notifications. Notifications is an Admin Setup page
(admin only, `/admin/notifications`, placeholder page today): a collapsible list of notifications grouped by
type on the left and the notification editor on the right. Back to the [index](../README.md). Entry
fields are described in [00-foundation.md](00-foundation.md). All tickets are **not started**; no
notifications API exists (needs in [api-contract.md](../api-contract.md#planned-endpoints)).

## 8.1 Reservation-triggered notifications list and editor

Excia/Guestrooms-Demo#78. Figma: editor and list 623:973, Reservation Trigger Menus 1935:7510.

- **Requirements (list):** notifications are organized by **type** (Triggered, Scheduled) in collapsible
  panels (opening one collapses the other) with counts ("Triggered (3)"); the first Triggered
  notification is selected by default and the first Scheduled one when that panel opens; the **new
  notification** split button offers New Triggered / New Scheduled (8.4); a new notification appears at the
  bottom of its type's list with the type label; **disabled** notifications stay in the list and reports
  but move to the bottom with a "disabled" indicator in place of the type label; a default template set
  is recommended at implementation (requirements document from page 85).
- **Requirements (editor):** header actions: **Enable Notification** toggle (off means never sends),
  delete, copy, **SAVE Notification**. **Notification Name**: required, max 100 characters, blank by
  default, unique. **Trigger Category** (required for Triggered): Reservations, Room Blocks, Waitlist,
  Housekeeping, Room Closure; **Trigger Type** list by category: Reservations: Reservation Booked,
  Reservation Updated (room assignments are not included in update triggers), Reservation Canceled,
  Checked In, Checked Out, Settled; Room Closure: Created, Updated, Removed; Housekeeping: Needs Cleaning,
  Cleaned, Maintenance Needed, Room Ready; Waitlist: Request Submitted, Updated, Canceled; Room Blocks:
  Created, Updated, Canceled. **Prompt before sending** toggle (8.4). **Send From Name** and **Send From
  Email**: both required, blank by default, email format validated. **Copy** creates "[name] (Copy)" with
  identical inputs (a duplicate name shows the standard error). **Delete** confirms, deletes, shows a
  toast in the top right and removes it from the list. **Save** validates (standard field errors) and the
  button changes to a **Saved** state. Unsaved changes prompt Confirm Leaving. Mock API (CRUD) behind the
  API client.
- **Open questions:** Q-78-1, Q-78-2.

## 8.2 Scheduled notifications

Excia/Guestrooms-Demo#79. Figma: Scheduled editor 1935:6582.

- **Requirements:** same header, name, send-from, recipients and content as the triggered editor, but the
  trigger section is replaced by a **Schedule**: number, time frame, before or after, reference moment.
  Time frames and ranges: Minutes 1-59, Hours 1-23, Days 1-364, Weeks 1-51, Months 1-12; changing the time
  frame updates the number options and a number outside the new range resets to blank and must be chosen
  again before saving (standard error). Relative time: before or after. Reference: Check-in day and time,
  Check out day and time, Reservation booking time. Example: "Pre-Check In: 1 hour before Check In day and
  time". The Prompt before sending toggle does not apply. A text preview of the schedule ("1 hour before
  check-in"); validation of required fields and a unique name; selection and ordering rules shared with 8.1.
- **Open questions:** Q-79-1, Q-79-2.

## 8.3 Recipients and attachments

Excia/Guestrooms-Demo#80. Figma: Attendee Recipient 1888:20976, Admin Recipient 1888:21035, Attachment
1888:19892.

- **Requirements:** **Attendee recipients:** default **Add Attendee Recipient** opens a multi-select
  ("Select Recipient Type"), grouped by Members and Non-Members, each with Reserver, Lead Occupant, Named
  Occupant; selections are chips; a red remove icon resets. **Admin recipients:** **Add Admin Recipient**
  with auto-suggest to find an employee; grouped by employee role (Admin, Management, Staff) with select
  all per role or individuals; a whole role shows one chip ("All Admin"), a partial selection shows
  names; typing a full email offers "Send to 'email@email.com'" for a custom address; a red remove
  resets. **Attachments:** none by default; **Add Email Attachment** opens a multi-select: **Reservation
  Folio** (PDF of the folio at send time), **Registration Card** (the generated PDF after check in, 7.8),
  **Custom** (a static uploaded file such as a guest policies document; up to X documents; the same file
  uploader as room type images, whose frame shows "SVG, PNG, JPG or GIF (max. 3MB)"). Recipient list from
  employees (Admin Setup) and reservation roles. Validation: at least one recipient before enabling or
  saving (to be confirmed). Tests for chip collapsing and custom email detection.
- **Open questions:** Q-80-1, Q-80-2.

## 8.4 New notification options and prompt-before-sending tooltip

Excia/Guestrooms-Demo#81. Figma: New Notification Options 1888:19871, Prompt before sending tooltip 625:1220,
setting in the Triggered editor 623:973.

- **Requirements:** the new-notification split button menu creates a draft of the chosen type
  (**New Triggered Notification**, **New Scheduled Notification**). **Prompt before sending** (Triggered
  only): when on, a prompt appears **at the time of the trigger**: "Would you like to send [Notification
  Name]?" **Yes** (primary) sends, then the prompt updates to confirm it was sent with a Close button and
  an X; **No** (secondary) hides it and does not send; it cannot be dismissed by clicking outside. An
  **info icon** next to the toggle opens a dialog explaining the setting with a sample prompt graphic.
  The runtime prompt shows after the triggering action (e.g. check in on the hub) for each notification
  with the setting on, queued if several fire at once; Yes sends through the notifications API (mock).
- **Open questions:** Q-81-1, Q-81-2.

## 8.5 Notification content editor and snippets

Excia/Guestrooms-Demo#100 (added during refinement). Figma: Triggered editor Content 623:973, Scheduled
editor Content 1935:6582.

- **Requirements:** **Message Subject** (required, max XX characters); **Body Text** rich text with an
  **Edit HTML** option (sanitized); **Plain Text Version** (required); **SMS / Push Notification Version**
  (required, max XX characters, validated); all blank by default; blank required fields show standard
  errors on save; character counters and limits. **Snippets** ("cheat sheet", Snippet Values): a button per
  snippet inserts it at the cursor in the focused field or copies it. Potential snippets: Booking Guest,
  Reserver, Lead Occupant, Occupant Names; Check In Date and Time; Check Out Date and Time; Length of Stay;
  Number of Rooms; Location; Room Type; Number of Occupants; Average Nightly Rate; **Single Night Rate**
  (shows the adjusted rate if one applies, not the standard rate category rate); Estimated Total; Room
  Block; Canceled Room Quantity; Reservation Number; System Name. Token syntax defined in one place;
  preview with sample data per snippet including the adjusted rate rule.
- **Open questions:** Q-100-1, Q-100-2.
