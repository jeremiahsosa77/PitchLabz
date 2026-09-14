import type { Field } from "../../components/forms";
import { text, opts } from "../../components/hub-types";
export const athleteFields: Field[] = [
  text("first_name", "First name"),
  text("last_name", "Last name"),
  text("date_of_birth", "Birth date", "date"),
  text("school", "School (optional)", "text", false),
  text("graduation_year", "Graduation year (optional)", "number", false),
  opts("competitive_level", "Level", [
    "youth",
    "middle_school",
    "high_school",
    "college",
    "adult",
  ]),
  opts("throws", "Throwing arm", ["R", "L", "S"]),
  text("goals", "Development goals", "textarea", false),
];
