// Shared data + types for the At-Home Training feature.
// Both the list screen and the detail screen import from here.

export type Level = "Beginner" | "Intermediate" | "Advanced";

export type IconKey =
  | "onevones"
  | "passing"
  | "dribbling"
  | "shooting"
  | "juggling"
  | "running"
  | "situps"
  | "pushups"
  | "jumping"
  | "stretching";

export interface BreakdownMove {
  name: string;
  subtitle: string; // e.g. "30 sec" or "10 reps"
  description: string;
}

export interface BreakdownSection {
  title: string;
  moves: BreakdownMove[];
}

export interface TrainingCard {
  id: string;
  level: Level;
  name: string;
  icon: IconKey;
  durationMinutes: number;
  people: string;
  equipment: string; // tag label: "No equipment" or "Some equipment"
  description: string;
  equipmentList: string[];
  breakdown: BreakdownSection[];
}

// Filler data — placeholder content to be replaced with real workouts.
const PLACEHOLDER_DESCRIPTION =
  "This session is designed to be done at home with minimal setup. Move through each segment at your own pace and focus on quality of movement over speed.";

const PLACEHOLDER_BREAKDOWN: BreakdownSection[] = [
  {
    title: "Warm Up",
    moves: [
      {
        name: "Jog in Place",
        subtitle: "1 min",
        description:
          "Light jog to raise your heart rate and prepare the body for movement. Keep arms relaxed and breathe steadily.",
      },
      {
        name: "Arm Circles",
        subtitle: "20 reps",
        description:
          "10 forward, 10 backward. Open the chest and loosen the shoulders.",
      },
      {
        name: "Leg Swings",
        subtitle: "10 reps each",
        description:
          "Swing each leg forward and back while holding a support. Then side to side. Keep the motion controlled.",
      },
    ],
  },
  {
    title: "Main Block",
    moves: [
      {
        name: "Set 1",
        subtitle: "4 rounds",
        description:
          "Move through the prescribed exercises with short rest between rounds. Keep your form clean throughout.",
      },
      {
        name: "Set 2",
        subtitle: "30 sec on / 15 sec off",
        description:
          "Push the pace while maintaining control. Recover between intervals — this is your engine block.",
      },
      {
        name: "Set 3",
        subtitle: "3 rounds",
        description:
          "Finish strong. Quality reps are better than rushed reps, even at the end.",
      },
    ],
  },
  {
    title: "Cooldown",
    moves: [
      {
        name: "Walking Recovery",
        subtitle: "1 min",
        description:
          "Walk it out, hands above your head, deep nasal breathing. Bring your heart rate down gradually.",
      },
      {
        name: "Static Stretch",
        subtitle: "5 min",
        description:
          "Hold each stretch 20–30 seconds. Hips, hamstrings, quads, calves, and chest.",
      },
    ],
  },
];

const COMMON_EQUIPMENT = ["Soccer Ball"];
const SOME_EQUIPMENT = ["Soccer Ball", "Cones", "Wall or Rebounder"];
const FITNESS_EQUIPMENT = ["Resistance Band", "Mini Band", "Moderate Dumbbells"];

const withDetails = (
  base: Omit<TrainingCard, "description" | "equipmentList" | "breakdown">,
  category: "technical" | "fitness",
): TrainingCard => ({
  ...base,
  description: PLACEHOLDER_DESCRIPTION,
  equipmentList:
    base.equipment === "Some equipment"
      ? category === "fitness"
        ? FITNESS_EQUIPMENT
        : SOME_EQUIPMENT
      : COMMON_EQUIPMENT,
  breakdown: PLACEHOLDER_BREAKDOWN,
});

export const TECHNICAL_CARDS: TrainingCard[] = [
  { id: "t1",  level: "Beginner",     icon: "juggling",  name: "First Touch Foundations",  durationMinutes: 15, people: "Individual", equipment: "No equipment" },
  { id: "t2",  level: "Beginner",     icon: "dribbling", name: "Inside-Outside Footwork",  durationMinutes: 20, people: "Individual", equipment: "No equipment" },
  { id: "t3",  level: "Intermediate", icon: "passing",   name: "Wall-Pass Combinations",   durationMinutes: 25, people: "2 people",   equipment: "Some equipment" },
  { id: "t4",  level: "Intermediate", icon: "dribbling", name: "Cone Dribbling Circuit",   durationMinutes: 20, people: "Individual", equipment: "Some equipment" },
  { id: "t5",  level: "Advanced",     icon: "shooting",  name: "Long-Range Striking",      durationMinutes: 30, people: "Individual", equipment: "Some equipment" },
  { id: "t6",  level: "Intermediate", icon: "onevones",  name: "1v1 Attacking Patterns",   durationMinutes: 25, people: "2 people",   equipment: "No equipment" },
  { id: "t7",  level: "Advanced",     icon: "passing",   name: "Small-Sided Possession",   durationMinutes: 40, people: "3-4 people", equipment: "Some equipment" },
  { id: "t8",  level: "Intermediate", icon: "passing",   name: "Receiving Under Pressure", durationMinutes: 20, people: "2 people",   equipment: "No equipment" },
  { id: "t9",  level: "Advanced",     icon: "shooting",  name: "Crossing and Finishing",   durationMinutes: 30, people: "3-4 people", equipment: "Some equipment" },
  { id: "t10", level: "Intermediate", icon: "juggling",  name: "Air Control Patterns",     durationMinutes: 20, people: "Individual", equipment: "No equipment" },
].map((c) => withDetails(c as any, "technical"));

export const FITNESS_CARDS: TrainingCard[] = [
  { id: "f1",  level: "Intermediate", icon: "running",    name: "Match-Pace Conditioning",    durationMinutes: 25, people: "Individual", equipment: "No equipment" },
  { id: "f2",  level: "Advanced",     icon: "jumping",    name: "Plyometric Power Block",     durationMinutes: 20, people: "Individual", equipment: "No equipment" },
  { id: "f3",  level: "Intermediate", icon: "pushups",    name: "Lower-Body Strength",        durationMinutes: 30, people: "Individual", equipment: "Some equipment" },
  { id: "f4",  level: "Beginner",     icon: "situps",     name: "Core and Stability",         durationMinutes: 15, people: "Individual", equipment: "No equipment" },
  { id: "f5",  level: "Beginner",     icon: "stretching", name: "Hip Mobility Flow",          durationMinutes: 15, people: "Individual", equipment: "No equipment" },
  { id: "f6",  level: "Advanced",     icon: "running",    name: "Sprint Interval Set",        durationMinutes: 25, people: "Individual", equipment: "No equipment" },
  { id: "f7",  level: "Intermediate", icon: "pushups",    name: "Partner Resistance Circuit", durationMinutes: 30, people: "2 people",   equipment: "No equipment" },
  { id: "f8",  level: "Advanced",     icon: "situps",     name: "Posterior-Chain Builder",    durationMinutes: 25, people: "Individual", equipment: "Some equipment" },
  { id: "f9",  level: "Beginner",     icon: "stretching", name: "Active Recovery Flow",       durationMinutes: 20, people: "Individual", equipment: "No equipment" },
  { id: "f10", level: "Beginner",     icon: "jumping",    name: "Game-Day Activation",        durationMinutes: 10, people: "Individual", equipment: "No equipment" },
].map((c) => withDetails(c as any, "fitness"));

export const findCardById = (id: string): TrainingCard | undefined =>
  TECHNICAL_CARDS.find((c) => c.id === id) ||
  FITNESS_CARDS.find((c) => c.id === id);
