import { images } from './images';

export interface CareerEntry {
  icon: string; // path relative to /public/assets/icons/
  name: string;
}

export interface CareerSection {
  label: string; // "Youth" | "College" | "Professional" | "National Team"
  entries: CareerEntry[];
}

export interface Coach {
  id: number;
  name: string;
  title: string;
  handle: string;
  slug: string;
  status: string;
  avatarUrl: string;
  bio?: string[];
  career?: CareerSection[];
}

const ICONS = '/assets/icons/';

export const coaches: Coach[] = [
  {
    id: 1,
    name: 'Phillip Gyau',
    title: 'Director & Head Coach',
    handle: 'coach2',
    slug: 'phillip-gyau',
    status: 'Available',
    avatarUrl: images.coach2,
    bio: [
      "Phillip Gyau was born on February 7, 1966, in Silver Spring, Maryland, the son of Joseph \"Nana\" Gyau, who represented Ghana's national team. He attended Gwynn Park High School in Brandywine, Maryland, before going on to Howard University from 1982 to 1985, where he established himself as one of the top collegiate players of his era. His success at Howard helped pave the way for a lengthy professional career spanning both indoor and outdoor soccer.",
      "As a forward, Gyau won the National Amateur Cup with Club España in 1985 before embarking on a professional career that included stints with the Washington Diplomats, Maryland Bays, Tampa Bay Rowdies, Colorado Foxes, Los Angeles Salsa, Montreal Impact, Baltimore Blast, and Washington Warthogs. His most decorated stint came with the Maryland Bays in the American Professional Soccer League, where he was named the 1990 APSL MVP and First Team All-Star after scoring 12 goals. He earned six caps for the U.S. Men's National Team between 1989 and 1991.",
      "Following his outdoor career, Gyau became a central figure in U.S. beach soccer, spending nine years with the U.S. National Beach Soccer Team and serving as captain from 1997 onward. He then transitioned into coaching, serving as head coach of the U.S. National Beach Soccer Team from 1998 to 2002. He subsequently coached at Bullis School, St. John's College High School, and the Olney Pumas before becoming head coach of the Howard University men's soccer program in 2014.",
      "At Next Star Soccer, Gyau brings decades of experience at every level of the game—collegiate, professional, national team, and coaching—to help develop the next generation of elite players. His philosophy centers on technical excellence, positional intelligence, and the competitive mindset required to succeed at the highest levels. His son, Joe Gyau, followed in his footsteps by playing professionally and representing the U.S. Men's National Team.",
    ],
    career: [
      {
        label: 'College',
        entries: [
          { icon: `${ICONS}howard.png`, name: 'Howard University' },
        ],
      },
      {
        label: 'National Team',
        entries: [
          { icon: `${ICONS}usa.png`, name: 'US Men\'s National Team' },
        ],
      },
      {
        label: 'Professional',
        entries: [
          { icon: `${ICONS}washingtonDiplomats.png`, name: 'Washington Diplomats' },
          { icon: `${ICONS}marylandBays.png`, name: 'Maryland Bays' },
          { icon: `${ICONS}tampaBayRowdies.png`, name: 'Tampa Bay Rowdies' },
          { icon: `${ICONS}coloradoFoxes.png`, name: 'Colorado Foxes' },
          { icon: `${ICONS}losAngelesSalsa.png`, name: 'Los Angeles Salsa' },
          { icon: `${ICONS}montreal.png`, name: 'Montreal Impact' },
          { icon: `${ICONS}baltimoreBlast.png`, name: 'Baltimore Blast' },
          { icon: `${ICONS}washingtonWarthogs.png`, name: 'Washington Warthogs' },
        ],
      },
    ],
  },
  {
    id: 2,
    name: 'Paul Torres',
    title: 'Director & Head Coach',
    handle: 'coach1',
    slug: 'paul-torres',
    status: 'Available',
    avatarUrl: images.coach1,
    bio: [
      "Paul Torres began his soccer journey with the Bethesda Roadrunners, where he won three state and two regional championships. He later captained the D.C. United U16 and U18 Academy teams, winning the U17 MLS Cup championship and leading two teams to Youth MLS Cup titles. A standout player, Torres was twice named D.C. United Academy Player of the Year and earned the U-17 MLS Cup MVP award. In 2008 and 2009, he was selected to the U.S. Soccer Federation U16 Starting XI and the Region 1 U18 Starting XI in 2009.",
      "Starting at age 16, Torres trained with the D.C. United first team, an experience that helped prepare him for collegiate and professional success. In 2009, Torres was recruited by the University of Maryland, where he played for two years before launching a six-year professional career in Sweden and Norway. Known for his technical skills, versatility, and leadership, he excelled as both a midfielder and an attacking player, earning recognition for his vision, precise passing, and ability to elevate his team's performance.",
      "After retiring from professional soccer, Torres transitioned into coaching and youth development, founding Next Star Soccer, a premier academy dedicated to nurturing young talent. The academy focuses on developing players' technical skills, tactical awareness, and mental preparation, ensuring they are well-equipped to advance in the game. Under Torres' leadership, Next Star Soccer has built a strong reputation for personalized training programs, including camps, clinics, and one-on-one coaching.",
      "Many of its graduates have gone on to play for college programs, elite academies, and professional teams. Torres is passionate about mentoring aspiring athletes and fostering a love for the game. Through his work at Next Star Soccer, he aims to shape the future of American soccer by creating well-rounded, multidimensional players who can compete on the international stage.",
    ],
    career: [
      {
        label: 'Youth',
        entries: [
          { icon: `${ICONS}bethesda.png`, name: 'Bethesda Roadrunners' },
          { icon: `${ICONS}dcUnited.png`, name: 'D.C. United Academy' },
          { icon: `${ICONS}usa.png`, name: 'US Youth National Team' },
        ],
      },
      {
        label: 'College',
        entries: [
          { icon: `${ICONS}maryland.png`, name: 'University of Maryland' },
        ],
      },
      {
        label: 'Professional',
        entries: [
          { icon: `${ICONS}syrianskafc.png`, name: 'Syrianska FC' },
          { icon: `${ICONS}assyriskaff.png`, name: 'Assyriska FF' },
          { icon: `${ICONS}ikSirius.png`, name: 'IK Sirius' },
          { icon: `${ICONS}sandnesUlf.png`, name: 'Sandnes Ulf' },
          { icon: `${ICONS}landskronaBolS.png`, name: 'Landskrona BoIS' },
          { icon: `${ICONS}nykopingsBIS.png`, name: "Nyköping's BIS" },
        ],
      },
    ],
  },
  {
    id: 3,
    name: 'Ryan Machado',
    title: 'Pro Coach',
    handle: 'coach3',
    slug: 'ryan-machado',
    status: 'Available',
    avatarUrl: images.coach4,
  },
  {
    id: 4,
    name: 'Gonzalo Carrasco',
    title: 'Pro Coach',
    handle: 'coach4',
    slug: 'gonzalo-carrasco',
    status: 'Available',
    avatarUrl: images.coach3,
  },
  {
    id: 5,
    name: 'Patrick Mullins',
    title: 'Pro Coach',
    handle: 'coach5',
    slug: 'patrick-mullins',
    status: 'Available',
    avatarUrl: images.coach7,
    bio: [
      "Patrick Mullins, born on February 5, 1992, in New Orleans, Louisiana developed a passion for soccer early on, excelling in the sport throughout his youth. He attended the University of Maryland, where he became one of the most decorated players in college soccer history. Playing for the Maryland Terrapins, Mullins earned back-to-back MAC Hermann Trophy honors in 2012 and 2013, an accolade awarded to the best collegiate soccer player in the nation.",
      "During his time at Maryland, Mullins helped lead the Terrapins to two NCAA College Cup appearances, showcasing his ability to rise in critical moments. He finished his collegiate career with an impressive 47 goals and 35 assists. Mullins was selected 11th overall in the 2014 MLS SuperDraft by the New England Revolution, where he made an immediate impact. In his rookie season, he played a key role in helping the team reach the MLS Cup Final.",
      "Known for his clinical finishing, intelligent positioning, and tireless work rate, Mullins quickly gained recognition as a reliable and dynamic forward. After his stint with New England, Mullins went on to play for several MLS clubs, including New York City FC, D.C. United, Columbus Crew SC, and Toronto FC. His most memorable performances came during his time with D.C. United, particularly in the 2017 season when he scored 13 goals, including a remarkable four-goal game against the San Jose Earthquakes.",
      "Mullins' career was defined not only by his talent but also by his resilience and professionalism. Known for his strong work ethic and leadership, he was respected by teammates and coaches for his ability to motivate those around him and mentor younger players. Since retiring from professional soccer, Mullins has remained deeply involved in the sport, dedicating his time to mentoring young players and contributing to the development of youth soccer.",
    ],
    career: [
      {
        label: 'Youth',
        entries: [
          { icon: `${ICONS}louisianafirejuniors.png`, name: 'Chicago Fire Juniors' },
          { icon: `${ICONS}batonrougecapitals.png`, name: 'Baton Rouge Capitals' },
        ],
      },
      {
        label: 'College',
        entries: [
          { icon: `${ICONS}maryland.png`, name: 'University of Maryland' },
        ],
      },
      {
        label: 'Professional',
        entries: [
          { icon: `${ICONS}newEnglandRevolution.png`, name: 'New England Revolution' },
          { icon: `${ICONS}newyorkcityfc.png`, name: 'New York City FC' },
          { icon: `${ICONS}dcUnited.png`, name: 'D.C. United' },
          { icon: `${ICONS}columbusCrew.png`, name: 'Columbus Crew' },
          { icon: `${ICONS}torontofc.png`, name: 'Toronto FC' },
        ],
      },
    ],
  },
  {
    id: 6,
    name: 'Marco Etcheverry',
    title: 'Pro Coach',
    handle: 'coach6',
    slug: 'marco-etcheverry',
    status: 'Available',
    avatarUrl: images.coach5,
    bio: [
      "Marco Etcheverry was born on September 26, 1970, in Santa Cruz, Bolivia. He began his soccer journey in Bolivia, showcasing his exceptional talent as a young midfielder with Bolívar and Oriente Petrolero. His performances quickly garnered attention, and he later moved to Colo-Colo in Chile where he solidified his reputation as an electrifying playmaker. Known for his vision, dribbling skills, and ability to control the tempo of a match, Etcheverry became a rising star in South American soccer.",
      "On the international stage, Etcheverry was the face of Bolivian soccer during the 1990s. He earned over 70 caps for the national team and played a pivotal role in Bolivia's qualification for the 1994 FIFA World Cup—their first appearance since 1950. Etcheverry further cemented his legacy by leading Bolivia to a runner-up finish in the 1997 Copa América, where his creativity and leadership shone. His electrifying performances and devilish dribbling earned him the nickname \"El Diablo.\"",
      "In 1996, Etcheverry brought his brilliance to Major League Soccer as a foundational player for D.C. United during the league's inaugural season. As the team's attacking midfielder and captain, he became the heart and soul of the squad. Under his leadership, D.C. United achieved unparalleled success, winning three MLS Cup championships (1996, 1997, 1999) and four Eastern Conference titles. Known for his pinpoint passing, decisive goals, and ability to create chances, Etcheverry quickly became a fan favorite and a league icon.",
      "Etcheverry's on-field brilliance earned him numerous accolades, including the MLS MVP award in 1998. He was a consistent presence in the MLS Best XI and was later named to the MLS All-Time Best XI. Recognized as one of the league's greatest-ever players, he was also honored as one of the top 25 players in MLS history. After retiring, Etcheverry transitioned into coaching, including a role at D.C. United Academy with their U-15s, before joining Next Star Soccer.",
    ],
    career: [
      {
        label: 'Youth',
        entries: [
          { icon: `${ICONS}tahuichiacademy.png`, name: 'Tahuichi Academy' },
          { icon: `${ICONS}bolivia.png`, name: 'Bolivia Youth NT' },
        ],
      },
      {
        label: 'Professional',
        entries: [
          { icon: `${ICONS}cdOrientePetrolero.png`, name: 'CD Oriente Petrolero' },
          { icon: `${ICONS}csEmelec.png`, name: 'CS Emelec' },
          { icon: `${ICONS}barcelonasc.png`, name: 'Barcelona SC' },
          { icon: `${ICONS}dcUnited.png`, name: 'D.C. United' },
          { icon: `${ICONS}cdAmericadeCali.png`, name: 'CD América de Cali' },
          { icon: `${ICONS}bolivarlapaz.png`, name: 'Bolívar La Paz' },
          { icon: `${ICONS}cdsColoColo.png`, name: 'CDS Colo-Colo' },
          { icon: `${ICONS}albaceteBalompie.png`, name: 'Albacete Balompié' },
          { icon: `${ICONS}clubDestroyers.png`, name: 'Club Destroyers' },
        ],
      },
      {
        label: 'National Team',
        entries: [
          { icon: `${ICONS}bolivia.png`, name: 'Bolivia National Team' },
        ],
      },
    ],
  },
  {
    id: 7,
    name: 'Steve Birnbaum',
    title: 'Pro Coach',
    handle: 'coach7',
    slug: 'steve-birnbaum',
    status: 'Available',
    avatarUrl: images.coach6,
    bio: [
      "Steve Birnbaum, born on January 23, 1991, in Newport Beach, California, is a former professional soccer player, U.S. Men's National Team veteran, and long-time captain of D.C. United. Renowned for his defensive prowess, leadership, and aerial dominance, Birnbaum rose through the ranks of American soccer to become one of Major League Soccer's most respected players. His journey began in Southern California, where he excelled in youth soccer before attending the University of California, Berkeley.",
      "At Cal, he earned All-American honors and established himself as one of the top defensive prospects in the country. Birnbaum's professional career took off in 2014 when he was selected as the second overall pick in the MLS SuperDraft by D.C. United. He quickly became a key figure in their backline, earning praise for his physicality, tactical awareness, and reliability. Known for his dominance in the air and ability to score from set pieces, Birnbaum was instrumental in D.C. United's success and was named team captain in 2017.",
      "Internationally, Birnbaum represented the United States Men's National Team, earning multiple caps and contributing crucial moments, including a game-winning goal in a 2016 friendly. He participated in World Cup qualifiers and friendlies, showcasing his abilities at the international level and further establishing his reputation as a dependable and versatile defender. After 11 seasons with D.C. United, Birnbaum retired in 2024, leaving a legacy as one of the club's most influential players.",
      "At the time of his retirement, he ranked third in all-time appearances for D.C. United, a testament to his durability and dedication throughout his career. He transitioned to coaching, joining the team at Next Star Soccer. He now uses his extensive experience to mentor young athletes, emphasizing technical skill development, mental resilience, and perseverance.",
    ],
    career: [
      {
        label: 'Youth',
        entries: [
          { icon: `${ICONS}pateadoressc.png`, name: 'Pateadores SC' },
        ],
      },
      {
        label: 'College',
        entries: [
          { icon: `${ICONS}ucberkeley.png`, name: 'UC Berkeley' },
        ],
      },
      {
        label: 'Professional',
        entries: [
          { icon: `${ICONS}dcUnited.png`, name: 'D.C. United' },
          { icon: `${ICONS}richmondkickers.png`, name: 'Richmond Kickers' },
          { icon: `${ICONS}orangeCountyBlueStar.png`, name: 'Orange County Blue Star' },
        ],
      },
      {
        label: 'National Team',
        entries: [
          { icon: `${ICONS}usa.png`, name: 'US Men\'s National Team' },
        ],
      },
    ],
  },
  {
    id: 8,
    name: 'Chris Pontius',
    title: 'Pro Coach',
    handle: 'coach8',
    slug: 'chris-pontius',
    status: 'Available',
    avatarUrl: images.coach8,
    bio: [
      "Born and raised in Yorba Linda, California, Chris Pontius developed a love for soccer early in life. His dedication and work ethic became evident during his youth career, laying the foundation for his future success. He attended Servite High School in Anaheim, where he honed his skills and emerged as a standout player, earning recognition for his technical ability and versatility on the field.",
      "Pontius went on to play college soccer at the University of California, Santa Barbara (UCSB), where he became a key contributor to the Gauchos' success. During his time at UCSB, Pontius helped lead the team to the 2006 NCAA National Championship, solidifying his reputation as a dynamic and versatile player. Over his collegiate career, he earned multiple accolades, including being named to the All-Big West First Team and receiving All-American honors.",
      "In 2009, Pontius was selected seventh overall by D.C. United in the MLS SuperDraft. Known for his ability to play both as a midfielder and forward, Pontius showcased his versatility and knack for scoring crucial goals. He earned MLS All-Star honors in 2012 after a stellar season in which he scored 12 goals and provided four assists. After six successful seasons with D.C. United, Pontius joined the Philadelphia Union in 2016, enjoying one of the best years of his career by scoring 12 goals and earning his second MLS Comeback Player of the Year award.",
      "Pontius later played for the LA Galaxy, contributing his experience and leadership to the team before retiring from professional soccer in 2019. Over his 11-year MLS career, Pontius amassed over 300 appearances, scoring 52 goals and providing 35 assists. Following his retirement, Pontius transitioned into coaching and mentorship at Next Star, working with players of all levels and focusing on building technical skills, tactical awareness, and mental resilience.",
    ],
    career: [
      {
        label: 'Youth',
        entries: [
          { icon: `${ICONS}strikersfcirvine.png`, name: 'Strikers FC Irvine' },
        ],
      },
      {
        label: 'College',
        entries: [
          { icon: `${ICONS}ucsb.png`, name: 'UC Santa Barbara' },
        ],
      },
      {
        label: 'Professional',
        entries: [
          { icon: `${ICONS}dcUnited.png`, name: 'D.C. United' },
          { icon: `${ICONS}philadelphiaunion.png`, name: 'Philadelphia Union' },
          { icon: `${ICONS}lagalaxy.png`, name: 'LA Galaxy' },
        ],
      },
      {
        label: 'National Team',
        entries: [
          { icon: `${ICONS}usa.png`, name: 'US Men\'s National Team' },
        ],
      },
    ],
  },
  {
    id: 9,
    name: 'Noah Satriano',
    title: 'Collegiate Coach',
    handle: 'coach9',
    slug: 'noah-satriano',
    status: 'Available',
    avatarUrl: images.coach9,
  },
  {
    id: 10,
    name: 'Gabe Segal',
    title: 'Pro Coach',
    handle: 'coach10',
    slug: 'gabe-segal',
    status: 'Available',
    avatarUrl: images.coach10,
  },
];
