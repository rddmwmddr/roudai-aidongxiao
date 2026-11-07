# Motion Prompt

来源：https://github.com/showheyohtaki/motion-prompt ，提交 7819d3879eb7d5a1475c11c001bedffb5cab64af。MIT，见 LICENSE。

- `packs/`：原样复制的动效代码。
- `catalog.json`：每个动效的编号、分类、简体中文名和说明，取自原仓库。
- `zh.json`：画面里日文的中文译文，这里新写的。
- `hero.json`：每个动效停在哪一帧，`tools/mp_hero.mjs` 算出来的。

更新：换掉 `packs/` 和 `catalog.json`，跑 `python3 tools/import_motion_prompt.py`。有日文没翻译会报错。
