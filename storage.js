/* 学習提出管理：共通ストレージ基盤
 * 既存データを削除せず、新しい年度・学級単位のデータ領域を管理します。
 */
(function (global) {
  "use strict";

  const PREFIX = "lpm:";
  const SCHEMA_VERSION = 1;

  function datasetKey(year, grade, classNumber) {
    return `${PREFIX}dataset:v${SCHEMA_VERSION}:${year}:${grade}:${classNumber}`;
  }

  function settingsKey() {
    return `${PREFIX}settings:v${SCHEMA_VERSION}`;
  }

  function assertClassIdentity(identity) {
    const year = Number(identity.schoolYear);
    const grade = Number(identity.grade);
    const classNumber = Number(identity.classNumber);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error("年度は西暦4桁で指定してください。");
    }
    if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
      throw new Error("学年は1〜6で指定してください。");
    }
    if (!Number.isInteger(classNumber) || classNumber < 1 || classNumber > 20) {
      throw new Error("組は1〜20の整数で指定してください。");
    }
    return { schoolYear: year, grade, classNumber };
  }

  function readJSON(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`保存データを読み取れません（${key}）。元データは変更していません。`);
    }
  }

  function writeJSON(key, value) {
    const serialized = JSON.stringify(value);
    // 書き込み前にシリアライズ可能であることを確認済み。
    localStorage.setItem(key, serialized);
  }

  function createEmptyDataset(identity, settings) {
    return {
      schemaVersion: SCHEMA_VERSION,
      schoolYear: identity.schoolYear,
      classSettings: {
        grade: identity.grade,
        classNumber: identity.classNumber,
        classSize: Number(settings.classSize || 30),
        qrPrefix: String(settings.qrPrefix || `${identity.grade}${identity.classNumber}`)
      },
      homework: [],
      drills: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      migration: { status: "new", source: null }
    };
  }

  function getDataset(identity) {
    const id = assertClassIdentity(identity);
    return readJSON(datasetKey(id.schoolYear, id.grade, id.classNumber));
  }

  function saveDataset(identity, dataset) {
    const id = assertClassIdentity(identity);
    if (!dataset || dataset.schemaVersion !== SCHEMA_VERSION) {
      throw new Error("保存できないデータ形式です。");
    }
    if (dataset.schoolYear !== id.schoolYear ||
        dataset.classSettings.grade !== id.grade ||
        dataset.classSettings.classNumber !== id.classNumber) {
      throw new Error("保存先とデータの年度・学級が一致しません。");
    }
    const next = { ...dataset, updatedAt: new Date().toISOString() };
    writeJSON(datasetKey(id.schoolYear, id.grade, id.classNumber), next);
    return next;
  }

  function createDataset(identity, settings) {
    const id = assertClassIdentity(identity);
    const key = datasetKey(id.schoolYear, id.grade, id.classNumber);
    if (localStorage.getItem(key) !== null) {
      throw new Error("同じ年度・学級のデータが既にあります。上書きは行いません。");
    }
    const dataset = createEmptyDataset(id, settings || {});
    writeJSON(key, dataset);
    return dataset;
  }

  function getSettings() {
    return readJSON(settingsKey()) || {
      activeSchoolYear: 2026,
      grade: 3,
      classNumber: 1,
      classSize: 30,
      qrPrefix: "31"
    };
  }

  function saveSettings(settings) {
    const next = { ...settings };
    const size = Number(next.classSize);
    if (!Number.isInteger(size) || size < 1 || size > 60) {
      throw new Error("学級人数は1〜60人で指定してください。");
    }
    next.schoolYear = Number(next.schoolYear || next.activeSchoolYear || 2026);
    next.activeSchoolYear = next.schoolYear;
    next.grade = Number(next.grade);
    next.classNumber = Number(next.classNumber);
    next.classSize = size;
    next.qrPrefix = String(next.qrPrefix || `${next.grade}${next.classNumber}`);
    assertClassIdentity({
      schoolYear: next.schoolYear,
      grade: next.grade,
      classNumber: next.classNumber
    });
    if (!/^[0-9]{1,4}$/.test(next.qrPrefix)) {
      throw new Error("QRコード番号は1〜4桁の数字にしてください。");
    }
    writeJSON(settingsKey(), next);
    return next;
  }

  global.LPMStorage = {
    SCHEMA_VERSION,
    datasetKey,
    getDataset,
    saveDataset,
    createDataset,
    getSettings,
    saveSettings,
    createEmptyDataset,
    readJSON
  };
})(window);
