# Inline fields

A value of a few words is edited where it sits, not in the full-screen editor.

`InlineChoiceField` (`src/components/common/InlineChoiceField.tsx`) shows the value as a button. Clicking it turns it into a text box with a list under it. Picking from the list, pressing Enter or clicking away saves. Escape cancels. An empty or unchanged value is not saved.

| Prop | Use |
| --- | --- |
| `options` | The list to pick from. Leave out for plain text. |
| `allowCustom` | `true` (default): any text is accepted and the list narrows while typing. `false`: only a listed value can be saved. |
| `allowEmpty` | The field can be cleared by saving it empty. |
| `renderResting` | Draws the resting value yourself and gives you the function that starts editing. For a value whose click already does something, such as a scene title that opens the scene. |
| `inputMode` | `numeric` for a number. |
| `className` | How the resting value looks (a heading, a tag). |

## Where it is used

On a character card (`CharacterCard`, through `onEditInline`):

- **Name**: plain text.
- **Voice seed**: a number; the card checks it is a positive integer before saving.
- **Role**: free text with the suggestions in `STORY_ROLE_PRESETS` (`src/config/cast.ts`). Existing roles such as "Student" stay as they are.
- **Four-Corner role**: closed list, `CORNER_ROLE_OPTIONS`. The pipeline reads the stored values (`MAIN_CHARACTER`, `THE_CHALLENGER`, ...), so the card shows a label and saves the value.

On a scene:

- **Scene title** in Scene Studio, and on outline scene rows through the pencil (clicking the title there opens the scene).
- **POV character** in Scene Studio and on outline scene rows: free text, with the cast (Scene Studio) or the scene's characters (outline) as suggestions. It can be cleared.
- **Setting** in Scene Studio and on outline scene rows: plain text. It can be cleared.

Longer fields (backstory, goals, objective, voice profile) still open the full editor.

## Adding one

Render `InlineChoiceField` with the current value and save in `onCommit`. Put a list that more than one screen needs in `src/config`.

## Role stays a label

A model asked for a character's `<role>` often answers with a paragraph. `withShortRole`
(`src/domain/cast/role.ts`) keeps `role` to a few words and moves the paragraph to the
character's `summary`, which the card shows under the name. It runs where characters are
created (story setup, characters spawned mid-story, directives), when a role is saved from the
card, and when a saved story is opened, so older stories are repaired on load.

## Long text is read in the reader

The opposite case: an interview, a character sheet or a backstory is too long for a card.
**Read** on a character card opens `CharacterReader` (`src/components/cards`), a large dialog
that is full screen on a phone, with one tab per long text (`characterReaderSections.ts` decides
the tabs and leaves out empty ones). The **Character Sheet** and **Interview** buttons at the foot
of the card open it on that tab. The arrows, or the left and right keys, move to the next
character and keep the tab. The pencil beside a text opens the same edit modal the card uses.
`CastCards.tsx` holds which character is open.
