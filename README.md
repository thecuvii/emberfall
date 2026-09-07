# 余烬 · EMBERFALL — 丧钟执刑者

原创 Web 像素横版 **单场 Boss 战**。冷灰废墟、暗红植被、血色日环与红兜帽逐火者；没有关卡、杂兵、升级或刷装流程。不使用《死亡细胞》的素材。

## 运行

Node.js 22+、pnpm：

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

`dist/` 是可静态托管的成品。预生成 PNG 已随源码提供，运行游戏不需要 Python、Blender 或模型下载。当前提供 Amp orb 试玩，尚未部署到生产环境。

## 操作与战斗

| 动作                                  | 键鼠               | 标准映射手柄    |
| ------------------------------------- | ------------------ | --------------- |
| 移动                                  | A / D、方向键      | 左摇杆 / 方向键 |
| 可变高度跳跃                          | 空格 / W / ↑       | A               |
| 轻攻击连击，空中下斩                  | 鼠标左键（备用 J） | X               |
| 重攻击，按住蓄力、松开释放            | 鼠标右键（备用 L） | RT              |
| 翻滚，取消攻击/治疗                   | Ctrl（左右均可）   | B / RB          |
| 烬线：短程刃波，6 秒冷却              | Q                  | LB              |
| 回火：0.8 秒治疗，可打断，35 HP、两瓶 | F                  | Y               |
| 暂停                                  | Esc                | Start           |

小屏提供触控按钮，推荐桌面键盘或横屏。声音默认关闭，可开启原创合成音效；没有背景音乐。离开窗口自动暂停。

右键点按造成 48 点重击伤害；约 1 秒蓄满后造成 96 点，满蓄不会自动释放。翻滚、受击、指针取消与暂停会取消蓄力；移出画面松开鼠标也能正常释放。空格保留可变跳高。触屏有独立“重”按钮，按住蓄力。

Boss 为裂钟头、破祭服和重刑刃的执刑者。横扫、重砸地波、慢速三连火弹；半血后在当前动作结束的安全边界转阶段，追加冲锋。普通攻击有明显前摇与反击窗口，受击保护避免瞬间多重伤害；目标中等难度，仍需真人试玩校准。

## 中文 / English

游戏工具栏的语言选择器可即时切换简体中文和英文，覆盖页面、HUD、当前操作说明、暂停/胜败菜单及无障碍标签。不会重开战斗或重置生命与冷却；切换时会清除输入并取消正在进行的蓄力，避免误释放。

首次访问按浏览器语言选择，未匹配语言回退英文。选择保存到 `emberfall-language`，刷新后保留；浏览器禁用存储时仍可在本次页面切换。

`src/i18n.ts` 集中管理中英词条及占位符；静态文本仅更新原文本节点，不替换按钮或游戏画布。`tests/language-check.js` 检查运行中切换、菜单、键盘焦点和漏译，`tests/i18n.test.ts` 检查语言回退及变量一致性。

## Painter 美术与动画

主角与 Boss 的源姿势、技能序列帧均来自 painter；场景、补充粒子和弹道计算由代码实现。工具未提供底层模型版本选择，不能确认是 ChatGPT Image 2。

- `art/source/`：六张原始生成图，主角原有 32 个姿势、新增 16 个治疗/施法/死亡/下斩姿势，Boss 24 个战斗与结束姿势。
- `art/source/skill-icons.png`：另附 painter 生成的四格技能美术，压缩至 `public/ui/skills.png`。HUD 与触屏共用图标，显示冷却遮罩、计时、施放高亮和药剂余量；用尽药剂变灰。
- `art/source/combat-vfx.png`：24 帧刀弧、火焰刃波、治疗、震地、火弹、命中爆点；缩放至 `public/effects/combat.png`，使用 ADD 混合，黑色底不会遮挡角色。按模拟时钟播放，与停顿/暂停同步；蓄力与治疗特效跟随角色，中断时立即清理。
- 敌我配色分离：主角保留暖金余烬，Boss 的横扫、震地、火弹与命中效果使用冷蓝紫 `public/effects/boss-combat.png`。由原特效执行 `magick public/effects/combat.png -modulate 100,90,215 public/effects/boss-combat.png` 生成；红色地面危险预警不变。
- `tools/pack-generated.py`：基础主角图集与时序槽；重复槽不是额外独立绘制帧。
- `tools/pack-boss.py`：rembg 抠图、跨格刀刃裁切、洋红溢色修正、脚底对齐。逐帧释放推理进程，避免内存积累。
- 剔除 Boss 多刀、缺刀的错误姿势；死亡停留末帧，不循环复活。
- `src/game/animation.ts`：接触姿势与伤害共享动作时间；跑步按位移推进，落地可立即被新动作覆盖；翻滚即时取消，连击缓冲不等待整个动画结束。
- `scene.ts`：固定 60Hz 模拟与插值；hitstop 冻结两个角色动作，伤害帧同步插值端点，避免高刷新率下身体滑动。暂停冻结动作；重开丢弃旧 Run 的时债和输入。

生成的姿势仍有细节变化和有限的中间帧，并不等同于商业独立游戏的逐帧人工精修。60Hz 指模拟频率，不保证所有设备的实际渲染帧率。研究来源与制作方法见 `docs/dead-cells-animation-research.md`。

## 验证与代码

- `src/game/model.ts`：不依赖引擎的战斗、物理与 Boss 状态机。
- `src/main.ts`：键盘/触屏/手柄、对话框焦点、生命值与冷却 HUD。
- `tests/model.test.ts`：战斗规则、打断、死亡与仅用正常输入的两阶段通关模拟。
- `tests/animation.test.ts`：接触帧、暂停/停顿、落地与死亡时序。
- `tests/browser-check.js`：真实 Phaser + DOM 检查，含 Q/F、取消、暂停焦点、144Hz hitstop、手柄重开、Boss 血条 ARIA、胜败菜单。局部状态使用明确夹具。
- `tools/capture-animation.js`：真实时间 canvas 录像，以 DOM 键盘输入驱动，不修改生命值或技能属性。

```sh
agent-browser --session emberfall eval --stdin < tests/browser-check.js
```

开发版提供 `window.emberfall` 供检查，生产版不暴露。前轮 Oracle 发现的菜单转换旧 Run 调用、hitstop 插值滑动问题在此版本保留修复与回归检查；不是美术质量认证。真实硬件手柄、iOS Safari、低端手机尚未实机验证。Vite 的 Phaser chunk >500kB 是体积警告，不是构建失败。Google Fonts 不可达时回退系统字体，游戏图像与音效无外部运行时依赖。
