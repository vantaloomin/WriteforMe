# Inline fields

A value of a few words is edited where it sits, not in the full-screen editor.

`InlineChoiceField` (`src/components/common/InlineChoiceField.tsx`) shows the value as a button. Clicking it turns it into a text box with a list under it. Picking from the list, pressing Enter or clicking away saves. Escape cancels. An empty or unchanged value is not saved.

| Prop | Use |
| --- | --- |
| `options` | The list to pick from. Leave out for plain text. |
| `allowCustom` | `true` (default): any text is accepted and the list narrows while typing. `false`: only a listed value can be saved. |
| `className` | How the resting value looks (a heading, a tag). |

## Where it is used

On a character card (`CharacterCard`, through `onEditInline`):

- **Name**: plain text.
- **Role**: free text with the suggestions in `STORY_ROLE_PRESETS` (`src/config/cast.ts`). Existing roles such as "Student" stay as they are.
- **Four-Corner role**: closed list, `CORNER_ROLE_OPTIONS`. The pipeline reads the stored values (`MAIN_CHARACTER`, `THE_CHALLENGER`, ...), so the card shows a label and saves the value.

Longer fields (backstory, goals, voice) still open the full editor.

## Adding one

Render `InlineChoiceField` with the current value and save in `onCommit`. Put a list that more than one screen needs in `src/config`.
