// NOTE: パラメータパネルのステートマシン
// ボリューム編集や音素タイミング編集といった編集対象(機能)単位ではなく、
// パラメータパネル全体のステートマシンである理由として:
// - ScoreSequencer側のステートマシンと同様の設計とし揃える
// のが主目的で、
// 後で編集対象単位でステートマシンを持つように変更することも可能だと思うので、
// とりあえず今はScoreSequencer側に合わせておくのがいいかもといったニュアンス
// たとえば複数のパネルをスタックさせるようなUIにする場合は前提が変わるため、その際に別途判断する
import {
  ParameterPanelStateDefinitions,
  ParameterPanelInput,
  ParameterPanelContext,
  ParameterPanelIdleStateId,
} from "./common";
import { DrawVolumeIdleState } from "./states/drawVolumeIdleState";
import { EraseVolumeIdleState } from "./states/eraseVolumeIdleState";
import { DrawVolumeState } from "./states/drawVolumeState";
import { EraseVolumeState } from "./states/eraseVolumeState";
import { StateMachine } from "@/sing/stateMachine";

export const createParameterPanelStateMachine = (
  context: ParameterPanelContext,
  initialState: ParameterPanelIdleStateId,
) => {
  return new StateMachine<
    ParameterPanelStateDefinitions,
    ParameterPanelInput,
    ParameterPanelContext
  >(
    {
      drawVolumeIdle: () => new DrawVolumeIdleState(),
      eraseVolumeIdle: () => new EraseVolumeIdleState(),
      drawVolume: (args) => new DrawVolumeState(args),
      eraseVolume: (args) => new EraseVolumeState(args),
    },
    context,
    initialState,
  );
};
