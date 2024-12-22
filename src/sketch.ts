import p5 from "p5"
import { Midi } from "@tonejs/midi"

/* 静的な値 */

const musicSetting = {
  // 何拍子か
  beatCount: 4,
  // BPM
  bpm: 173,
  // ドラムMidiファイル名
  drumMidiFileName: "drum.mid",
  // バスドラムのMidiID
  drumKickMidiID: 36,
  // スネアドラムのMidiID
  drumSnareMidiID: 38,
  // シンバルのMidiID
  drumCymbalMidiID: 49,
}

const frameSetting = {
  // 横に何個配置するか (拍子と同じ)
  columnCount: musicSetting.beatCount,
  // 縦に何行配置するか (小節と同じ)
  rowCount: 1,
  // 枠同士のpadding
  padding: 3,
  // 大きさ
  size: 50,
  // 枠線の色
  color: "#CCCCCC",
}

const beatSetting = {
  // 1拍当たりのミリ秒 (結構ズレることあるから適宜-6とかしちゃってる><)
  beatMs: Math.floor((60 / musicSetting.bpm) * 1000 * (4 / musicSetting.beatCount)),
  // 1拍当たりのtick数 (4分の4拍子の場合1拍480tick)
  beatTick: 480 * (4 / musicSetting.beatCount),
  // 枠からのpadding
  padding: 5,
}

const convasSetting = {
  height: 400,
  backgroundColor: "#222222",
}

enum beatType {
  // 拍の中に1つでもシンバルがあった場合
  Cymbal,
  // 拍の中にシンバルがなく、スネアが1つでもあった場合
  Snare,
  // 拍の中にシンバル・スネアがなく、キックが1つでもあった場合
  Kick,
}

/* 動的な値 */

const midi = {
  // Map<小節(measureCount): Map<拍(beatCount): 種別(beatType)>>,
  drumMap: new Map<number, Map<number, beatType>>(),
}

const progress = {
  // 何小節目か
  measureCount: 0,
  // 何拍目か
  beatCount: 0,
  // 最後に拍を更新したミリ秒
  lastBeatTimeMs: 0,
}

async function preload(): Promise<void> {
  const drumMidiData = await Midi.fromUrl(`/${musicSetting.drumMidiFileName}`)
  drumMidiData.tracks[0]?.notes.forEach((note) => {
    const totalbeatCount = Math.floor(note.ticks / beatSetting.beatTick)
    const measureCount = Math.floor(totalbeatCount / musicSetting.beatCount) + 1
    const beatCount = (totalbeatCount % musicSetting.beatCount) + 1

    if (!midi.drumMap.has(measureCount)) {
      midi.drumMap.set(measureCount, new Map())
    }

    const measureMap = midi.drumMap.get(measureCount)!
    switch (note.midi) {
      case musicSetting.drumCymbalMidiID:
        measureMap.set(beatCount, beatType.Cymbal)
        break
      case musicSetting.drumSnareMidiID:
        // 既にシンバルがあれば何もしない
        if (measureMap.get(beatCount) == beatType.Cymbal) {
          break
        }
        measureMap.set(beatCount, beatType.Snare)
        break
      case musicSetting.drumKickMidiID:
        // 既にシンバル・スネアがあれば何もしない
        if (
          measureMap.get(beatCount) == beatType.Cymbal ||
          measureMap.get(beatCount) == beatType.Snare
        ) {
          break
        }
        measureMap.set(beatCount, beatType.Kick)
        break
    }
  })
}

// 初期描画
function setup(p: p5): void {
  p.createCanvas(p.windowWidth, convasSetting.height)
  p.rectMode(p.CENTER)
  p.background(convasSetting.backgroundColor)
  drawFrames(p)
}

// フレーム毎描画
function draw(p: p5): void {
  p.background(convasSetting.backgroundColor)
  drawFrames(p)
  drawBeat(p)
  // 拍子ごとの処理
  if (p.millis() - progress.lastBeatTimeMs >= beatSetting.beatMs) {
    if (progress.beatCount % musicSetting.beatCount == 0) {
      progress.beatCount = 0
      progress.measureCount++
    }
    progress.lastBeatTimeMs = p.millis()
    progress.beatCount++
  }
}

// 拍子の枠組みを描画する
function drawFrames(p: p5): void {
  const { columnCount, rowCount, padding, size, color } = frameSetting

  p.noFill()
  p.stroke(color)
  p.strokeWeight(1)
  const startX =
    (p.width - columnCount * size - (columnCount - 1) * padding) / 2
  const startY = (p.height - rowCount * size - (rowCount - 1) * padding) / 2

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < columnCount; col++) {
      const posX = startX + col * (size + padding) + size / 2
      const posY = startY + row * (size + padding) + size / 2
      p.square(posX, posY, size)
    }
  }

  p.textSize(10)
  p.fill("#FFFFFF")
  p.strokeWeight(0)
  p.text(
    `BPM: ${musicSetting.bpm},  measure: ${progress.measureCount},  beat: ${progress.beatCount}/${musicSetting.beatCount}`,
    startX,
    startY - 10,
  )
}

// 枠組みの中身を描画する
function drawBeat(p: p5): void {
  if (progress.beatCount == 0) return

  const { columnCount, rowCount, padding, size } = frameSetting

  const startX =
    (p.width - columnCount * size - (columnCount - 1) * padding) / 2
  const startY = (p.height - rowCount * size - (rowCount - 1) * padding) / 2

  const currentCol = progress.beatCount
  const currentRow = ((progress.measureCount - 1) % rowCount) + 1

  for (let row = 1; row <= rowCount; row++) {
    const measure = progress.measureCount + row - currentRow
    for (let col = 1; col <= columnCount; col++) {
      // 未来の枠は空
      if (row > currentRow || (row == currentRow && col > currentCol)) {
        continue
      }
      const posX = startX + (col - 1) * (size + padding) + size / 2
      const posY = startY + (row - 1) * (size + padding) + size / 2

      const easeRate =
        row == currentRow && col == currentCol
          ? (p.millis() - progress.lastBeatTimeMs) / beatSetting.beatMs
          : 1
      const easingSize = (size - beatSetting.padding) * easeInOutQuad(easeRate)
      const rotationAngle = easeRate * Math.PI * 2 // Rotate full circle (2π) during the beat

      switch (midi.drumMap.get(measure)?.get(col)) {
        case beatType.Cymbal:
          p.push()
          p.translate(posX, posY)
          p.rotate(rotationAngle)
          p.fill(255)
          p.square(0, 0, easingSize)
          p.pop()
          break
        case beatType.Snare:
          p.fill(255)
          p.square(posX, posY, easingSize)
          p.fill(convasSetting.backgroundColor)
          p.square(posX, posY, easingSize / 1.3)
          break
        case beatType.Kick:
          p.fill(255)
          p.square(posX, posY, easingSize)
          break
        case undefined: {
          p.fill(255)
          p.stroke(255)
          p.strokeWeight(1)
          const rightTopPosX = posX + size / 2 - padding
          const rightTopPosY = posY - size / 2 + padding
          p.line(
            rightTopPosX,
            rightTopPosY,
            rightTopPosX - easingSize + padding / 2,
            rightTopPosY + easingSize - padding / 2,
          )
          p.noStroke()
          break
        }
      }
    }
  }
}

// イージングアニメーション関数
function easeInOutQuad(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -15 * x)
}

const sketch = (p: p5) => {
  p.preload = () => preload()
  p.setup = () => setup(p)
  p.draw = () => draw(p)
}

new p5(sketch)
