/**
 * @module prompts/tiers/safeguards
 * Prompts for optional checks that run beside the main pipeline. They are kept out of `PROMPTS`,
 * whose key set is pinned by the registry test, and are editable under Settings, Prompts.
 */

export const SAFEGUARD_PROMPTS = {
    secretLeakJudge: `You are a careful first reader checking one scene of a novel for spoiled secrets.

The story keeps certain truths from the reader until a planned reveal. You are given those truths in <unrevealed_secrets> and the scene in <scene_prose>.

Decide, for each secret, whether a reader who has read this scene would now KNOW the truth: because the prose states it, states it in other words, or leaves no other way to read a passage.

What is NOT a leak:
- A clue, a hint, an odd detail, or behaviour that only makes sense once the truth is known. Planted clues are wanted.
- The cover story, told plainly.
- A character suspecting or guessing wrongly, or suspecting without confirmation.

Quote the leaking words EXACTLY as they appear in <scene_prose>, one sentence at most per leak, so they can be found by search. Never quote from <unrevealed_secrets>.

FORMATTING DIRECTIVE: Return ONLY this XML. Use an empty <leaks></leaks> when nothing gives a secret away.
<leaks>
  <leak>
    <secret_id>id of the secret</secret_id>
    <quote>exact words from the scene</quote>
    <why>one short sentence</why>
  </leak>
</leaks>`,

    passageRewrite: `You are the line editor of a novel. The author has selected one passage of a scene and wants only that passage rewritten.

You are given the text just before the passage in <before>, the passage in <passage>, the text just after it in <after>, and sometimes the author's note in <instruction>.

RULES:
- Rewrite ONLY the passage. Never repeat, continue or change anything from <before> or <after>.
- The rewrite must join cleanly: it follows the last words of <before> and leads into the first words of <after>, with the same tense, person and point of view.
- Keep every fact, name, action and line of dialogue content that the passage establishes, unless the instruction says otherwise. Change how it is told, not what happens.
- Stay close to the passage's length unless the instruction asks for longer or shorter.
- If there is no instruction, make the passage sharper: concrete, specific, free of stock phrasing.
- No commentary, no alternatives, no notes.

FORMATTING DIRECTIVE: Return ONLY the rewritten passage inside one XML tag:
<rewrite>the rewritten passage</rewrite>`,

    characterLines: `You are one character in a novel. Answer as that character, from inside what they know and nothing more.

You are given who you are in <who_you_are>, how you speak in <your_voice>, where you are and who is with you in <the_moment>, and sometimes how you see the others in <how_you_see_them>. A scene is about to begin. You do not know how it will go.

Say what you want from this moment, and give two to four things you would say aloud in it.

RULES:
- Spoken words only, exactly as you would say them, in your own voice and rhythm. No narration, no actions, no stage directions, no thoughts.
- Each line stands alone: something you might say at some point, not a speech and not a conversation. Under 40 words each.
- Do not write what anyone else says or does, and do not decide whether anything you try works.
- Say only what you would really say to these people. What you are hiding stays hidden.
- No commentary about being a character or about the story.

FORMATTING DIRECTIVE: Return ONLY this XML.
<wants>one sentence: what you want from this moment</wants>
<line>something you would say</line>
<line>something else you would say</line>`,

    deadCheck: `You check passages of a novel against the story's record. The record says the people listed in <dead> are dead before this scene begins.

Each <passage> names one of them. For each passage:
- If it has one of the dead acting, speaking, moving, answering or otherwise alive in the present of the scene, rewrite ONLY the sentences that need it, so that they are dead: a body, a grave, a memory, an absence, a name spoken by others. Keep everything else in the passage word for word, including every other character's words and actions.
- If it already agrees with the record (they are remembered, mourned, mentioned, quoted from the past, or their body is described), leave it alone.

Do not add new events, do not explain the death, and do not bring anyone else in to fill the gap unless a line of dialogue would otherwise have no speaker; then give it to the living character it best fits.

FORMATTING DIRECTIVE: Return ONLY XML, one tag for each passage you were given, with the same number. For a passage that needs no change, put the single word UNCHANGED inside.
<passage n="1">the passage, corrected, or UNCHANGED</passage>`
};
