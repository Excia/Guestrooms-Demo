# LP-A.9 Image uploader and reorder (Room Types, Rooms, Add-On Items)

Ticket Excia/Guestrooms-Demo#190. Figma: no frame in the ticket (label `needs-design`); the existing Photos
field (11964:28502, Image Placeholder 11964:13054) is kept and the legacy behavior is added to it.
**Status:** in review, PR for #190, 2026-10-28.

Legacy sources (read only): `Setup/Shared/ImageContainerInput.vue` (grid, delete), `ImageUploadInput.vue`
(upload, limits, messages), `ImageEditOrder.vue` (order dialog), `services/FileServices/FileService.ts` (limits).

## Figma deviations

| ID       | Area               | Figma               | Built                                                                                                   | Why                                                       | Choice |
| -------- | ------------------ | ------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------ |
| F-190-1  | Photos: order      | no frame            | An "Edit photo order" button beside ADD PHOTOS (two or more photos) opens a dialog, as the legacy app   | The ticket has no design; legacy has the same dialog      | agent  |
| F-190-2  | Photos: delete     | red X badge only    | The X arms the photo; a red Delete button replaces it for 5 s (usable after 0.5 s), as the legacy app   | Legacy asks twice before deleting a stored photo          | agent  |

## Open questions

| ID       | Question                                                                                                                                                 | Blocks | Default used                                                          | Who answers | Status |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------- | ----------- | ------ |
| Q-190-1  | Legacy has no limit on photos per record, only 10 files per upload. Keep the 50-photo total (invented earlier, ticket 7.3)?                              | no     | 50 total, 10 per upload                                               | owner       | open   |
| Q-190-2  | Legacy uploads, deletes and reorders immediately (each is its own request, only on a saved record). Here photos are part of the form and save with it. OK? | no     | Photos change the form and save with the record; new records can add  | owner       | open   |
| Q-190-3  | Legacy accepts .jpg and .png only (1.5 MB); the earlier build also took WebP at 5 MB. Legacy limits are used now. Allow WebP and a larger size later?    | no     | JPG and PNG, 1.5 MB per file                                          | owner       | open   |

## Decisions

| ID       | Date       | Decision                                                                                                                                                      | Why                                   | Source        | Status |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------- | ------ |
| D-190-1  | 2026-10-28 | Upload rules follow the legacy app: JPG or PNG, 1.5 MB per file, 10 files per upload, file name sanitized (letters, digits, `.` `-` `_`) to 1 to 255 characters | "Match the legacy app where it behaves a certain way" | ticket 190    | done   |
| D-190-2  | 2026-10-28 | Reorder is a dialog with Save and Cancel, drag and drop plus earlier/later buttons (keyboard); delete is the legacy two-step                                    | Legacy behavior, made keyboard operable | ticket 190    | done   |
| D-190-3  | 2026-10-28 | The mock stores image metadata only; the backend stores files. Delete and order are carried by the record's `photos` list on save                              | Ticket: "mock stores image metadata only" | ticket 190    | done   |

## Placeholders and invented values

- **P-190-1:** `RoomPhoto.url` is empty from the mock; the form previews the picked file with an object URL (`src/components/admin/roomSetup/PhotosField.tsx`). Photos loaded from a saved record show the striped placeholder until the storage service exists (Q-72-1).
- **P-190-2:** the 50-photo total (`MAX_PHOTOS` in `src/app/photos.ts`), see Q-190-1.

## API, permissions, notes

- **API:** new `photos.upload(request)` (`PhotoApi` in `src/api/types.ts`): `POST /photos` with `{owner: 'room-type' | 'room' | 'add-on', entityId: string | null, existingCount, files: [{name, type, size}]}`, answers `RoomPhoto[]` (one per file, in order). Errors: 422 `validation` (details `photos` lists each refused file) and 5xx. The real backend takes the file bytes (multipart) and stores them; the contract moves to multipart then. Saving a room type, room or add-on item already carries `details.photos` / `photos` in display order, so removing and reordering need no call of their own. Add a row to `api-contract.md` when the backend work starts.
- **Permissions:** none new. The photo controls are hidden in view-only mode (read-only context); the save of the record stays guarded by `<page>.edit`.
- **Notes:** rules live in `src/app/photos.ts` (unit tested); the mock re-checks them like the backend will. Accessibility: file input named "Photo files", live regions for upload success, errors in a `role="alert"`, move announcements in the order dialog, delete confirmation keeps focus and Escape cancels; after a removal or a lapsed Delete the focus moves to the next photo's remove button (else the previous, else Add photos) and the live region says "Photo removed".
- **Q-190-2 consequence, orphan uploads:** an upload is stored before the record is saved. A user who uploads and then discards or leaves leaves stored files that no record references. The backend must sweep uploads not referenced by a saved record after a grace period (or tie them to a draft token). The UI revokes its local preview URLs on remove, discard, save and unmount, but cannot delete the stored file.
- **Backend must enforce:** the total of 50 photos per record (the client only blocks it; `existingCount` in the request is the client's word and must not be trusted); the 10 files per upload, 1.5 MB per file and the name rules; and it must re-validate every file by content (JPEG or PNG signature, decodable image), not by the name or MIME type the browser sent. The client checks extension (.jpg, .jpeg, .png), MIME type and the first bytes (JPEG `FF D8 FF`, PNG 8-byte signature) only for early feedback.
- **D-190-4, stored name:** the name sent and stored is the file name without any folder part, sanitized with the legacy rule and without leading dots (`../../my photo (1).png` becomes `myphoto1.png`). The mock does the same; the backend must too.
- **1.5 MB is decimal.** Legacy `FileService.MAX_IMAGE_FILE_SIZE_BYTES = 1.5e6` is 1,500,000 bytes (Quasar `max-file-size` is in bytes), not 1.5 MiB (1,572,864). This build uses 1,500,000 (`PHOTO_MAX_BYTES`).
- **Switching records:** the photo field is keyed by the record id; an upload still running when the record changes is aborted and its result ignored.
