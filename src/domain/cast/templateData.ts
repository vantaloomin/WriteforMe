/**
 * @module domain/cast/templateData
 * Genre cast templates: for each genre, the four sides a story of that kind usually has, with a
 * hint for what each side stands for. Data from the Dramatis project (cast_genres.json).
 */

export interface CastGenreTemplate {
    id: string;
    name: string;
    /** One line on how a cast of this genre is laid out. */
    help: string;
    /** What the people inside one side usually fight each other over. */
    insideFight: string;
    /** True where everyone on a side shares a motive and each hides something different. */
    sharedSecret: boolean;
    sides: ReadonlyArray<{ label: string; hint: string }>;
}

export const CAST_GENRE_TEMPLATES: ReadonlyArray<CastGenreTemplate> = [
    {
        id: 'adventure-fantasy',
        name: 'Adventure fantasy',
        help: 'A party on a quest, someone paying for it, someone in the way, and a rival company after the same prize.',
        insideFight: 'They all want to win. They disagree on what a win looks like.',
        sharedSecret: false,
        sides: [
            {
                label: 'The party',
                hint: 'Why they set out, and what they think finishing will give them'
            },
            {
                label: 'The patron',
                hint: 'What the quest is really for, from the one paying'
            },
            {
                label: 'The villain',
                hint: 'What they want the prize for, and why it feels right to them'
            },
            {
                label: 'The rival company',
                hint: 'Why they think the prize should be theirs'
            }
        ]
    },
    {
        id: 'political-fantasy',
        name: 'Political fantasy',
        help: "Four powers, each sure the realm should run its way. Split the hero's side first, then the main opponent's.",
        insideFight: 'They agree on why. They fight about how.',
        sharedSecret: false,
        sides: [
            {
                label: 'The throne',
                hint: 'The order it thinks holds the realm together'
            },
            {
                label: 'The rebels',
                hint: 'The freedom it thinks the realm is owed'
            },
            {
                label: 'The temple',
                hint: 'The higher law it answers to'
            },
            {
                label: 'The old houses',
                hint: 'The rights and blood it thinks come first'
            }
        ]
    },
    {
        id: 'heist',
        name: 'Heist or crime',
        help: "A crew, a mark, the law, and a rival outfit. The crew agrees on the score and fights over what it's worth.",
        insideFight: "They agree on the goal. They fight about what it's worth paying.",
        sharedSecret: false,
        sides: [
            {
                label: 'The crew',
                hint: 'What the score will set right for them'
            },
            {
                label: 'The mark',
                hint: 'Why they think what they have is theirs to keep'
            },
            {
                label: 'The law',
                hint: 'What they think catching the crew protects'
            },
            {
                label: 'The rival outfit',
                hint: 'Why they want the same score'
            }
        ]
    },
    {
        id: 'thriller',
        name: 'Thriller or spy',
        help: 'An agency, the enemy service, a hidden player and the press. Inside the agency, how clean the work stays is the fight.',
        insideFight: 'They agree on the mission. They fight about how far it can bend.',
        sharedSecret: false,
        sides: [
            {
                label: 'The agency',
                hint: 'What it thinks it keeps safe'
            },
            {
                label: 'The enemy service',
                hint: "What it thinks it's defending"
            },
            {
                label: 'The hidden player',
                hint: 'What they gain while the others fight'
            },
            {
                label: 'The press',
                hint: 'Why they think the public should know'
            }
        ]
    },
    {
        id: 'war',
        name: 'War',
        help: 'Our side, the enemy, command and the civilians caught between. The unit fights over who it follows.',
        insideFight: 'They agree where to go. They fight about who decides.',
        sharedSecret: false,
        sides: [
            {
                label: 'The unit',
                hint: "What they're fighting for, as they'd put it"
            },
            {
                label: 'The enemy',
                hint: "Why their side thinks it's right"
            },
            {
                label: 'Command',
                hint: 'What winning the war means from far away'
            },
            {
                label: 'The civilians',
                hint: 'What they need to come out of it with'
            }
        ]
    },
    {
        id: 'space-opera',
        name: 'Space opera or sci-fi',
        help: 'A ship or colony, an empire, something alien or artificial, and rebels. The crew or council splits on how to survive.',
        insideFight: 'They agree on why. They fight about how.',
        sharedSecret: false,
        sides: [
            {
                label: 'The ship',
                hint: "What keeps them flying, and what they're flying toward"
            },
            {
                label: 'The empire',
                hint: "The order it brings and why it thinks that's a gift"
            },
            {
                label: 'The other',
                hint: 'What the alien or the machine wants, in its own terms'
            },
            {
                label: 'The rebels',
                hint: "What they'd tear the empire down for"
            }
        ]
    },
    {
        id: 'western',
        name: 'Western or frontier',
        help: 'A town, the outlaws, the baron and the law. The town agrees it should survive and fights over how.',
        insideFight: 'They agree on why. They fight about how.',
        sharedSecret: false,
        sides: [
            {
                label: 'The town',
                hint: 'What a decent place to live means to them'
            },
            {
                label: 'The outlaws',
                hint: 'Why they think the land owes them'
            },
            {
                label: 'The baron',
                hint: 'What he thinks progress is'
            },
            {
                label: 'The law',
                hint: 'What a badge means out here'
            }
        ]
    },
    {
        id: 'horror',
        name: 'Horror',
        help: 'The monster, the survivors, the believers and a skeptical authority. The survivors all want out and fight over how.',
        insideFight: 'They agree on why. They fight about how.',
        sharedSecret: false,
        sides: [
            {
                label: 'The monster',
                hint: 'What it wants, or what it is'
            },
            {
                label: 'The survivors',
                hint: "Getting out alive, and who they'll save"
            },
            {
                label: 'The believers',
                hint: 'What they think the monster is owed'
            },
            {
                label: 'The authorities',
                hint: "The normal they think they're protecting"
            }
        ]
    },
    {
        id: 'mystery',
        name: 'Mystery',
        help: "The detective, the killer, the police and the victim's circle. Everyone in the circle had a reason, and each hides something else.",
        insideFight: 'They share a motive. Each one hides something different.',
        sharedSecret: true,
        sides: [
            {
                label: 'The detective',
                hint: 'Why the truth matters to them'
            },
            {
                label: 'The killer',
                hint: 'Why it had to happen, as they see it'
            },
            {
                label: 'The police',
                hint: 'What closing the case is for'
            },
            {
                label: "The victim's circle",
                hint: 'What they all wanted from the victim'
            }
        ]
    },
    {
        id: 'noir',
        name: 'Noir',
        help: "The investigator, the client, the mob and the law that's been bought. The client's circle shares a motive and hides different things.",
        insideFight: 'They share a motive. Each one hides something different.',
        sharedSecret: true,
        sides: [
            {
                label: 'The investigator',
                hint: "The line they still won't cross"
            },
            {
                label: 'The client',
                hint: 'What they say they want, and what they really want'
            },
            {
                label: 'The mob',
                hint: 'The order they keep, their way'
            },
            {
                label: 'The bought law',
                hint: 'What they tell themselves the money is for'
            }
        ]
    },
    {
        id: 'family-drama',
        name: 'Family drama',
        help: 'The family, the board, a buyer and the press. Think of the succession fights in prestige TV: everyone wants the company, each a different way.',
        insideFight: 'They agree on why. They fight about how.',
        sharedSecret: false,
        sides: [
            {
                label: 'The family',
                hint: 'What the name and the money mean to them'
            },
            {
                label: 'The board',
                hint: 'What they think the company is for'
            },
            {
                label: 'The buyer',
                hint: "What they'd make of it"
            },
            {
                label: 'The press',
                hint: 'What they think the public is owed'
            }
        ]
    },
    {
        id: 'romance',
        name: 'Romance',
        help: "The lead, the love interest, a rival and an obstacle. The lead's friends and family all want them happy and disagree on what that means.",
        insideFight: 'They all want to win. They disagree on what a win looks like.',
        sharedSecret: false,
        sides: [
            {
                label: 'The lead',
                hint: 'What they think love has to look like'
            },
            {
                label: 'The love interest',
                hint: "What they're protecting by keeping their distance"
            },
            {
                label: 'The rival',
                hint: "Why they think they're the better match"
            },
            {
                label: 'The obstacle',
                hint: 'The duty, distance or past that stands in the way'
            }
        ]
    },
    {
        id: 'coming-of-age',
        name: 'Coming-of-age',
        help: 'Adults in their twenties finding their place: the hero, their friends, the family and a rival circle. The friends all want a life of their own and disagree on what that takes.',
        insideFight: 'They all want to win. They disagree on what a win looks like.',
        sharedSecret: false,
        sides: [
            {
                label: 'The hero',
                hint: "Who they think they're meant to be"
            },
            {
                label: 'The friends',
                hint: 'What staying close is worth'
            },
            {
                label: 'The family',
                hint: 'The future they want for the hero'
            },
            {
                label: 'The rival circle',
                hint: 'What being on top proves'
            }
        ]
    },
    {
        id: 'sports-workplace',
        name: 'Sports or workplace',
        help: 'The team, a rival team, management and pressure from outside. The team wants to win and argues over what a win is.',
        insideFight: 'They all want to win. They disagree on what a win looks like.',
        sharedSecret: false,
        sides: [
            {
                label: 'The team',
                hint: 'What a win would prove'
            },
            {
                label: 'The rival team',
                hint: 'Why they think they deserve it more'
            },
            {
                label: 'Management',
                hint: 'What the numbers have to show'
            },
            {
                label: 'Outside pressure',
                hint: 'What the fans, the market or the family expect'
            }
        ]
    },
    {
        id: 'superhero',
        name: 'Superhero team',
        help: 'The team, the villain, the government and the public. The team agrees on protecting people and fights over how.',
        insideFight: 'They agree on why. They fight about how.',
        sharedSecret: false,
        sides: [
            {
                label: 'The team',
                hint: 'Who they think they protect'
            },
            {
                label: 'The villain',
                hint: "The world they'd make, and why it's better to them"
            },
            {
                label: 'The government',
                hint: 'What control over powers is meant to keep safe'
            },
            {
                label: 'The public',
                hint: 'What they want from people with powers'
            }
        ]
    },
    {
        id: 'ensemble-comedy',
        name: 'Ensemble comedy',
        help: "The group, the boss, a rival group and an outsider. The group wants things to go well and can't agree what well means.",
        insideFight: 'They all want to win. They disagree on what a win looks like.',
        sharedSecret: false,
        sides: [
            {
                label: 'The group',
                hint: 'What a good day looks like to them'
            },
            {
                label: 'The boss',
                hint: 'What they think keeps the place running'
            },
            {
                label: 'The rival group',
                hint: "Why they think they're the better crowd"
            },
            {
                label: 'The outsider',
                hint: "What they see that the group can't"
            }
        ]
    },
    {
        id: 'procedural',
        name: 'Procedural (legal, medical)',
        help: 'The firm or ward, the other side, administration and the clients. Everyone wants the case won or the patient saved, at different prices.',
        insideFight: "They agree on the goal. They fight about what it's worth paying.",
        sharedSecret: false,
        sides: [
            {
                label: 'The firm',
                hint: 'What they think the work is for'
            },
            {
                label: 'The other side',
                hint: "Why they think they're in the right"
            },
            {
                label: 'Administration',
                hint: 'What keeps the doors open'
            },
            {
                label: 'The clients',
                hint: "What they need, which isn't always what they ask for"
            }
        ]
    }
];
