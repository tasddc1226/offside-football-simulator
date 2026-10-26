// T-11-141 확률 도감의 '확률과 공정성'(웹 ui/Fairness.svelte). 내용은 app-core fairnessView, 이력은 펼칠 때만 불러온다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { fairnessView, loadHistoryRows, type HistoryRow } from '@offside/app-core/fairness';
import { kstParts } from '@offside/app-core/boardText';
import { fairnessText as L } from '@offside/app-core/i18n/ko/fairness';
import { openBoard } from '../../game/nav';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Pill } from '../../ui/bits';
import { Txt } from '../../ui/Txt';
import { Fold, foldLine as line, Terms } from './Fold';

/** 표 한 줄: 왼쪽 이름, 오른쪽 숫자 칸들. */
function Cells({ cells, head }: { cells: readonly string[]; head?: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
      }}
    >
      {cells.map((t, i) => (
        <Txt
          key={i}
          tone={head ? 'muted' : undefined}
          bold={head}
          style={{
            flex: 1,
            fontSize: head ? rem(FONT.caption) : line.fontSize,
            textAlign: i ? 'right' : 'left',
            fontVariant: ['tabular-nums'],
          }}
        >
          {t}
        </Txt>
      ))}
    </View>
  );
}

const H3 = ({ children }: { children: string }) => (
  <Txt bold style={{ fontSize: rem(FONT.body2), marginTop: 14, marginBottom: 4 }}>
    {children}
  </Txt>
);
const Note = ({ children }: { children: string }) => (
  <Txt
    tone="muted"
    style={{ fontSize: rem(FONT.caption), lineHeight: rem(FONT.caption) * 1.5, marginTop: 6 }}
  >
    {children}
  </Txt>
);

function History() {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HistoryRow[] | 'error' | null>(null);
  const toggle = () => {
    setOpen((v) => !v);
    if (open || (rows !== null && rows !== 'error')) return;
    setRows(null);
    void loadHistoryRows().then(setRows);
  };
  return (
    <View style={{ marginTop: 14 }}>
      <Fold title={L.historyTitle} open={open} onToggle={toggle} testID="fair-history">
        {rows === null ? (
          <Txt tone="muted" accessibilityLiveRegion="polite" style={line}>
            {L.historyLoading}
          </Txt>
        ) : rows === 'error' ? (
          <Txt tone="muted" style={line}>
            {L.historyError}
          </Txt>
        ) : !rows.length ? (
          <Txt tone="muted" style={line}>
            {L.historyEmpty}
          </Txt>
        ) : (
          <View style={{ gap: 10 }}>
            {rows.map((h) => (
              <View
                key={h.id}
                testID={`fair-row-${h.kind}`}
                style={{
                  padding: 10,
                  borderRadius: RADIUS.sm,
                  backgroundColor: c.surface2,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Txt bold style={[line, { flex: 1 }]}>
                    {h.kind === 'version'
                      ? L.historyVersion({ v: h.version, day: kstParts(h.appliedAt).day })
                      : h.title}
                  </Txt>
                  {h.kind === 'patch' ? (
                    <Pill>{L.historyPatch}</Pill>
                  ) : h.active ? (
                    <Pill>{L.historyActive}</Pill>
                  ) : null}
                </View>
                {h.kind === 'patch' ? (
                  <>
                    <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
                      {L.historyPatchDay({ day: kstParts(h.appliedAt).day })}
                    </Txt>
                    {h.items.map((item) => (
                      <Txt key={item} style={line}>
                        {`· ${item}`}
                      </Txt>
                    ))}
                  </>
                ) : null}
                {h.changes.length ? (
                  h.changes.map(([name, diff]) => (
                    <Txt key={name} style={line}>
                      {`· ${name}`}
                      {diff ? (
                        <Txt tone="muted" style={line}>
                          {` ${diff}`}
                        </Txt>
                      ) : null}
                    </Txt>
                  ))
                ) : h.kind === 'version' ? (
                  <Txt tone="muted" style={line}>
                    {L.historySame}
                  </Txt>
                ) : null}
                {h.kind === 'patch' && h.postId ? (
                  <Txt
                    tone="muted"
                    style={[line, { textDecorationLine: 'underline', marginTop: 2 }]}
                    accessibilityRole="link"
                    testID="fair-patch-note"
                    onPress={() => openBoard('release', h.postId ?? null)}
                  >
                    {L.historyOpenNote}
                  </Txt>
                ) : null}
              </View>
            ))}
            <Note>{L.historyNote}</Note>
          </View>
        )}
      </Fold>
    </View>
  );
}

/** 펼쳤을 때만 그린다. */
function FairnessBody() {
  const V = useMemo(fairnessView, []);
  return (
    <>
      <Txt tone="muted" style={line}>
        {L.intro}
      </Txt>
      <Terms list={V.promises} />

      <H3>{L.potTitle}</H3>
      <Cells head cells={[L.gradeHead, L.colSeason, L.colPre]} />
      {V.pot.map((row) => (
        <Cells key={row[0]} cells={row} />
      ))}
      {V.potNotes.map((n) => (
        <Note key={n}>{n}</Note>
      ))}

      <H3>{L.boostTitle}</H3>
      {V.boost.map((row) => (
        <Cells key={row[0]} cells={row} />
      ))}
      <Note>{V.boostNote}</Note>

      <H3>{L.hiddenTitle}</H3>
      <Terms list={V.hidden} />

      <History />
    </>
  );
}

export function Fairness({ initialOpen }: { initialOpen: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <Fold title={L.title} open={open} onToggle={() => setOpen((v) => !v)} testID="fairness">
      <FairnessBody />
    </Fold>
  );
}
