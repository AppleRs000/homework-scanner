/* JSONバックアップ・検証・復元 */
(function (global) {
  "use strict";

  function exportDataset(identity) {
    const dataset = LPMStorage.getDataset(identity);
    if (!dataset) throw new Error("保存するデータが見つかりません。");
    const payload = {
      format: "learning-submission-management-backup",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      dataset
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dataset.schoolYear}年度_${dataset.classSettings.grade}年${dataset.classSettings.classNumber}組_全データ.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return payload;
  }

  function validateBackup(payload) {
    if (!payload || payload.format !== "learning-submission-management-backup" ||
        payload.formatVersion !== 1 || !payload.dataset) {
      throw new Error("このファイルは対応するバックアップ形式ではありません。");
    }
    const d = payload.dataset;
    if (d.schemaVersion !== LPMStorage.SCHEMA_VERSION ||
        !Number.isInteger(Number(d.schoolYear)) ||
        !d.classSettings || !Array.isArray(d.homework) || !Array.isArray(d.drills)) {
      throw new Error("バックアップの内容が不正、または未対応のバージョンです。");
    }
    return {
      schoolYear: Number(d.schoolYear),
      grade: Number(d.classSettings.grade),
      classNumber: Number(d.classSettings.classNumber),
      classSize: Number(d.classSettings.classSize),
      homeworkCount: d.homework.length,
      drillCount: d.drills.length
    };
  }

  async function restoreFile(file, mode) {
    const text = await file.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch (_) { throw new Error("JSONファイルを読み取れません。"); }

    const preview = validateBackup(payload);
    const identity = {
      schoolYear: preview.schoolYear,
      grade: preview.grade,
      classNumber: preview.classNumber
    };
    const key = LPMStorage.datasetKey(identity.schoolYear, identity.grade, identity.classNumber);
    const existing = localStorage.getItem(key);

    if (existing && mode !== "replace") {
      throw new Error("同じ年度・学級のデータが既にあります。上書きする場合は、事前バックアップと明示確認が必要です。");
    }
    if (existing) {
      // 上書き前の現状を別キーに退避。退避に失敗したら復元しない。
      const backupKey = `lpm:pre-restore:${Date.now()}`;
      localStorage.setItem(backupKey, existing);
    }

    LPMStorage.saveDataset(identity, payload.dataset);
    return preview;
  }

  global.LPMBackup = { exportDataset, validateBackup, restoreFile };
})(window);
