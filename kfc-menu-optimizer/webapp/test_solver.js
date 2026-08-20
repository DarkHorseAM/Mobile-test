const fs = require("fs");
const { solve } = require("./solver.js");
const menu = JSON.parse(fs.readFileSync(__dirname + "/../menu.json", "utf8"));

const cases = [
  ["zinger burger", "2x fries", "gravy", "drink"],
  ["10x chicken piece", "4x fries", "2x drink"],
  ["6x chicken piece", "4x fries", "2x gravy", "drink"],
  ["8x hot wing", "regular popcorn chicken", "drink"],
  ["5x tender", "2x chicken piece", "3x fries", "regular popcorn chicken", "zinger supercharger tower burger"],
  ["6x tender", "2x chicken piece", "4x fries", "regular popcorn chicken", "zinger supercharger tower burger"],
  ["large gravy"],
];
for (const wants of cases) {
  const r = solve(menu, wants);
  if (r.status !== "optimal") { console.log(wants.join(", "), "->", r.status); continue; }
  const items = r.basket.map(b => `${b.qty}x ${b.name}${b.opts.length ? " [" + b.opts.join(", ") + "]" : ""}`).join(" + ");
  console.log(`£${(r.totalPence / 100).toFixed(2)}  <- ${wants.join(", ")}\n        ${items}`);
}
