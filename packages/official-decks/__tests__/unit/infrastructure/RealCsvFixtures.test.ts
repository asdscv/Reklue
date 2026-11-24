import { describe, it, expect, beforeAll } from "vitest";
import { PapaCsvSource } from "@/infrastructure/csv/PapaCsvSource";
import { detectSchema } from "@/application/services/CsvSchemaDetector";
import { buildPlansForCsv } from "@/application/services/ImportPlanBuilder";
import { JAPANESE_WORD_TEMPLATE_ID } from "@/domain/entities/OfficialDeck";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const STUDY_DATA_PATHS = [
  process.env.STUDY_DATA_DIR,
  resolve(__dirname, "../../../../../../STUDY_DATA"),
  resolve(__dirname, "../../../../../STUDY_DATA"),
  resolve(__dirname, "../../../../STUDY_DATA"),
  resolve(__dirname, "../../../STUDY_DATA"),
].filter((p): p is string => typeof p === "string" && p.length > 0);
const STUDY_DATA = STUDY_DATA_PATHS.find((p) => existsSync(p));

describe.skipIf(!STUDY_DATA)("Real STUDY_DATA fixtures", () => {
  let source: PapaCsvSource;
  let csvList: readonly string[];

  beforeAll(async () => {
    source = new PapaCsvSource({ directory: STUDY_DATA! });
    csvList = await source.list();
  });

  it("lists exactly 53 CSVs (excluding chinese-pronunciation + sidecars)", () => {
    expect(csvList.length).toBe(53);
    expect(csvList).not.toContain("chinese-pronunciation.csv");
  });

  it("every CSV parses and is recognised by the schema detector", async () => {
    for (const name of csvList) {
      const csv = await source.read(name);
      const det = detectSchema(csv);
      expect(["A", "B", "C", "D"]).toContain(det.schema);
    }
  });

  it("builds 670 plans across the corpus, including seven Japanese plans", async () => {
    let total = 0;
    for (const name of csvList) {
      const csv = await source.read(name);
      const plans = buildPlansForCsv(csv, { skipMalformedRows: true });
      total += plans.length;
    }
    expect(total).toBe(670);
  });

  it("publishes each Japanese verb with a reading, examples and a meaning in every audience language", async () => {
    const plans = buildPlansForCsv(await source.read("jlpt-n5-everyday-verbs.csv"));
    expect(plans.map(({ deck }) => deck.languagePair.target).sort()).toEqual([
      "en", "es", "id", "ko", "th", "vi", "zh",
    ]);
    for (const { deck } of plans) {
      expect(deck.languagePair.source).toBe("ja");
      expect(deck.learningLanguage).toBe("ja");
      expect(deck.nativeLanguages).toEqual([deck.languagePair.target]);
      expect(deck.templateId).toBe(JAPANESE_WORD_TEMPLATE_ID);
      expect(deck.cards).toHaveLength(60);
      expect(new Set(deck.cards.map(({ fieldValues }) => fieldValues.front)).size).toBe(60);
      for (const { fieldValues } of deck.cards) {
        expect(fieldValues).toMatchObject({
          kind: "word",
          front: expect.stringMatching(/\S/u),
          reading: expect.stringMatching(/^[\p{Script=Hiragana}ー]+$/u),
          back: expect.stringMatching(/\S/u),
          example_front: expect.stringMatching(/。$/u),
          example_back: expect.stringMatching(/\S/u),
        });
      }
    }
    const korean = plans.find(({ deck }) => deck.languagePair.target === "ko");
    expect(korean?.deck.cards[0]?.fieldValues).toMatchObject({
      front: "行く", reading: "いく", back: "가다",
      example_front: "明日、学校へ行きます。", example_back: "내일 학교에 가요.",
    });
  });

  it("beginner_batch1.csv produces 14 plans (forward + reverse), each with cards", async () => {
    const csv = await source.read("beginner_batch1.csv");
    const plans = buildPlansForCsv(csv, { skipMalformedRows: true });
    expect(plans).toHaveLength(14);
    for (const plan of plans) {
      expect(plan.deck.cards.length).toBeGreaterThan(0);
    }
  });

  it("real-conversation-시사.csv produces 1 plan (ko→en)", async () => {
    const csv = await source.read("real-conversation-시사.csv");
    const plans = buildPlansForCsv(csv, { skipMalformedRows: true });
    expect(plans).toHaveLength(1);
    expect(plans[0]!.deck.languagePair.source).toBe("ko");
    expect(plans[0]!.deck.languagePair.target).toBe("en");
  });
});
