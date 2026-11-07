(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  let previewInfo = null;

  function show(message, type) {
    $("status").textContent = message;
    $("status").className = "notice" + (type ? ` ${type}` : "");
  }
  function identityFromForm() {
    return {
      schoolYear: Number($("year").value),
      grade: Number($("grade").value),
      classNumber: Number($("classNumber").value)
    };
  }
  function fill(settings) {
    $("year").value = settings.schoolYear || settings.activeSchoolYear || 2026;
    $("grade").value = settings.grade || 3;
    $("classNumber").value = settings.classNumber || 1;
    $("classSize").value = settings.classSize || 30;
    $("qrPrefix").value = settings.qrPrefix || `${$("grade").value}${$("classNumber").value}`;
  }
  function currentSettings() {
    return {
      ...identityFromForm(),
      classSize: Number($("classSize").value),
      qrPrefix: $("qrPrefix").value.trim()
    };
  }

  fill(LPMStorage.getSettings());

  $("grade").addEventListener("change", () => {
    $("qrPrefix").value = `${$("grade").value}${$("classNumber").value}`;
  });
  $("classNumber").addEventListener("change", () => {
    $("qrPrefix").value = `${$("grade").value}${$("classNumber").value}`;
  });

  $("saveSettings").addEventListener("click", () => {
    try {
      LPMStorage.saveSettings(currentSettings());
      show("共通設定を保存しました。データ領域の新規作成や既存データの移行は、別の操作で行います。");
    } catch (error) { show(error.message, "error"); }
  });

  $("createDataset").addEventListener("click", () => {
    try {
      const settings = LPMStorage.saveSettings(currentSettings());
      const identity = identityFromForm();
      LPMStorage.createDataset(identity, settings);
      show(`${identity.schoolYear}年度 ${identity.grade}年${identity.classNumber}組の新しいデータ領域を作成しました。`);
    } catch (error) { show(error.message, "error"); }
  });

  $("migrate").addEventListener("click", () => {
    if (!confirm("旧データを2026年度として新しい保存領域へコピーします。旧データは削除しません。続けますか？")) return;
    try {
      const result = LPMigration.migrate({
        grade: Number($("grade").value),
        classNumber: Number($("classNumber").value),
        classSize: Number($("classSize").value),
        qrPrefix: $("qrPrefix").value.trim()
      });
      $("year").value = 2026;
      show(
        "移行が完了しました。\n" +
        `宿題：${result.homeworkCount}件\n` +
        `提出日：${result.homeworkDateCount}日\n` +
        `提出済み記録：${result.submittedCount}件\n` +
        `欠席記録：${result.absentCount}件\n` +
        `ドリル：${result.drillCount}件\n` +
        `提出済みと欠席が重複していた記録：${result.conflictingAbsentAndSubmittedCount}件（欠席を優先）\n` +
        "旧データはそのまま残っています。"
      );
    } catch (error) { show(error.message, "error"); }
  });

  $("export").addEventListener("click", () => {
    try {
      LPMBackup.exportDataset(identityFromForm());
      show("JSONバックアップの保存を開始しました。");
    } catch (error) { show(error.message, "error"); }
  });

  $("preview").addEventListener("click", async () => {
    const file = $("backupFile").files[0];
    if (!file) { show("先にJSONファイルを選択してください。", "error"); return; }
    try {
      const payload = JSON.parse(await file.text());
      previewInfo = LPMBackup.validateBackup(payload);
      show(
        "バックアップ内容を確認しました。\n" +
        `年度：${previewInfo.schoolYear}年度\n` +
        `学級：${previewInfo.grade}年${previewInfo.classNumber}組\n` +
        `学級人数：${previewInfo.classSize}人\n` +
        `宿題：${previewInfo.homeworkCount}件\n` +
        `ドリル：${previewInfo.drillCount}件\n\n` +
        "既存データを上書きしない新規復元先として利用できます。"
      );
      $("restore").disabled = false;
    } catch (error) {
      previewInfo = null;
      $("restore").disabled = true;
      show(error.message, "error");
    }
  });

  $("restore").addEventListener("click", async () => {
    const file = $("backupFile").files[0];
    if (!file || !previewInfo) return;
    try {
      const targetIdentity = {
        schoolYear: previewInfo.schoolYear,
        grade: previewInfo.grade,
        classNumber: previewInfo.classNumber
      };
      if (LPMStorage.getDataset(targetIdentity)) {
        show("同じ年度・学級のデータが既にあります。安全のため復元を中止しました。", "error");
        return;
      }
      if (!confirm(`${previewInfo.schoolYear}年度 ${previewInfo.grade}年${previewInfo.classNumber}組として復元します。よろしいですか？`)) return;
      const result = await LPMBackup.restoreFile(file, "new");
      show(`復元しました。\n宿題：${result.homeworkCount}件\nドリル：${result.drillCount}件`);
      fill({
        schoolYear: result.schoolYear, grade: result.grade,
        classNumber: result.classNumber, classSize: result.classSize,
        qrPrefix: `${result.grade}${result.classNumber}`
      });
    } catch (error) { show(error.message, "error"); }
  });
})();
