import { analyse } from "@/lib/calc";
import { PCT, parseNum, prazoTxt, R } from "@/lib/format";
import { motivosMelhor } from "@/lib/report";
import { CountUp } from "./CountUp";
import { Icon } from "./ui";
import type { Projeto } from "@/lib/types";

export function Alerts({ P }: { P: Projeto }) {
  const { res } = analyse(P);
  const cred = res.filter((x) => x.sc.credito).map((x) => x.sc.nome);
  const dir = res.filter((x) => x.sc.modal === "direto").map((x) => x.sc.nome);
  return (
    <div className="alerts">
      {dir.length > 0 && (
        <div className="alert">
          <Icon name="warn" size={18} className="ai" />
          <span><b>DIFAL{P.ufCliente ? ` — cliente no ${P.ufCliente}` : ""}:</b> nos cenários de faturamento
          direto ({dir.join("; ")}) é preciso confirmar se o diferencial de alíquota fica por nossa conta.</span>
        </div>
      )}
      {cred.length > 0 && (
        <div className="alert">
          <Icon name="warn" size={18} className="ai" />
          <span><b>Crédito em análise:</b> {cred.join("; ")} dependem da aprovação de crédito do fornecedor.</span>
        </div>
      )}
      {P.obs
        .filter((o) => o.trim())
        .map((o, i) => (
          <div className="alert info" key={i}>
            <Icon name="info" size={18} className="ai" />
            <span>{o}</span>
          </div>
        ))}
    </div>
  );
}

export function Results({ P, onEditar }: { P: Projeto; onEditar: (a: "cenarios") => void }) {
  const { res, sorted, best, bestClean } = analyse(P);
  const cn = P.compl.fornecedor || "Item complementar";
  const hasC = parseNum(P.compl.valor) > 0;
  const off = (b: boolean) => (b ? "" : "off");

  const days = new Set<number>([0]);
  res.forEach((x) => {
    x.pMat.forEach((d) => days.add(d));
    if (hasC) x.pCompl.forEach((d) => days.add(d));
  });
  const cols = [...days].sort((a, b) => a - b);

  return (
    <>
      <section className="section">
        <h2 data-anim="rise">Cenários</h2>
        <div className="cards">
          {res.length === 0 && (
            <p className="hint">Nenhum cenário cadastrado. Abra a edição abaixo e clique em Adicionar cenário.</p>
          )}
          {res.map((x, i) => {
            const isBest = x === best && res.length > 1 && x.liq > 0;
            const second = sorted[1];
            const ded = P.ded.icms || P.ded.pis || P.ded.fin;
            return (
              <article className={`card${isBest ? " best" : ""}`} key={i} data-anim="panel">
                <div className="card-h">
                  <div>
                    <div className="eyebrow">Cenário {i + 1}</div>
                    <h3>{x.sc.nome}</h3>
                  </div>
                  <button className="btn ghost sm" onClick={() => onEditar("cenarios")} aria-label={`Editar ${x.sc.nome}`}><Icon name="edit" size={13} /> Editar</button>
                </div>
                <div className="tags">
                  {isBest && <span className="tag good">Menor custo</span>}
                  <span className="tag acc">{x.sc.modal === "direto" ? "Direto ao cliente" : "Via Alpha Filial"}</span>
                  {x.sc.credito && <span className="tag warn">Crédito em análise</span>}
                  {x.sc.modal === "direto" && <span className="tag warn">Verificar DIFAL</span>}
                </div>
                <div className="rows">
                  <div className="row sub">
                    <span>Materiais (fabricante)</span>
                    <span className="num">{R(x.mat)}</span>
                  </div>
                  {hasC && (
                    <div className="row sub">
                      <span>{cn}</span>
                      <span className="num">{R(x.C)}</span>
                    </div>
                  )}
                  <div className="row">
                    <span>Total bruto</span>
                    <span className="num">{R(x.bruto)}</span>
                  </div>
                  {P.ded.icms && (
                    <div className="row ded">
                      <span>ICMS {PCT(P.icms)}</span>
                      <span className="num">−{R(x.icms)}</span>
                    </div>
                  )}
                  {P.ded.pis && (
                    <div className="row ded">
                      <span>PIS/COFINS {PCT(x.pisRate)}</span>
                      <span className="num">−{R(x.pis)}</span>
                    </div>
                  )}
                  {x.fin > 0 ? (
                    <div className={`row ${P.ded.fin ? "ded" : "inc"}`}>
                      <span>
                        Taxa financeira {PCT(P.taxaFin)} {P.ded.fin ? "(retirada)" : "(inclusa)"}
                      </span>
                      <span className="num">
                        {P.ded.fin ? "−" : ""}
                        {R(x.fin)}
                      </span>
                    </div>
                  ) : (
                    <div className="row sub">
                      <span>Taxa financeira</span>
                      <span>— (à vista)</span>
                    </div>
                  )}
                  <div className="row total">
                    <span>{ded ? "Valor líquido" : "Valor total"}</span>
                    <CountUp className="big" value={x.liq} />
                  </div>
                </div>
                <div className="cond">
                  <div>
                    <b>Cond. materiais:</b> {prazoTxt(x.sc.prazoMat)}
                    {x.sc.credito ? " · aguardando crédito" : ""}
                  </div>
                  {hasC && (
                    <div>
                      <b>Cond. fornecedor {cn}:</b> {prazoTxt(x.sc.prazoCompl)}
                    </div>
                  )}
                </div>
                {isBest && (
                  <div className="why">
                    <b>Por que é a melhor opção</b>
                    <ul>
                      {motivosMelhor(P).map((m, k) => (
                        <li key={k}>
                          {m.ressalva && <b>Ressalva: </b>}
                          {m.texto}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2 data-anim="rise">Comparativo</h2>
        <div className="tbl-wrap" data-anim="wipe">
          <table>
            <thead>
              <tr>
                <th>Cenário</th>
                <th>Materiais</th>
                {hasC && <th>{cn}</th>}
                <th>Total bruto</th>
                <th className={off(P.ded.icms)}>ICMS</th>
                <th className={off(P.ded.pis)}>PIS/COFINS</th>
                <th className={off(P.ded.fin)}>Taxa fin.</th>
                <th>Líquido</th>
                <th>Cond. materiais</th>
                {hasC && <th>Cond. {cn}</th>}
              </tr>
            </thead>
            <tbody>
              {res.map((x, i) => (
                <tr key={i} className={x === best && res.length > 1 && x.liq > 0 ? "best-row" : ""}>
                  <td>
                    {i + 1}. {x.sc.nome}
                  </td>
                  <td className="num">{R(x.mat)}</td>
                  {hasC && <td className="num cell-c">{R(x.C)}</td>}
                  <td className="num">{R(x.bruto)}</td>
                  <td className={`num ${off(P.ded.icms)}`}>{R(x.icms)}</td>
                  <td className={`num ${off(P.ded.pis)}`}>{R(x.pis)}</td>
                  <td className={`num ${off(P.ded.fin)}`}>{x.fin ? R(x.fin) : "—"}</td>
                  <td className="num">
                    <b>{R(x.liq)}</b>
                  </td>
                  <td>{prazoTxt(x.sc.prazoMat)}</td>
                  {hasC && <td>{prazoTxt(x.sc.prazoCompl)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2 data-anim="rise">Cronograma de pagamentos</h2>
        <div className="legend">
          <span>Materiais (fabricante)</span>
          {hasC && <span className="c">{cn}</span>}
        </div>
        <div className="tbl-wrap" data-anim="wipe">
          <table>
            <thead>
              <tr>
                <th>Cenário</th>
                {cols.map((d) => (
                  <th key={d}>{d ? "D+" + d : "D0"}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {res.map((x, i) => {
                const cell: Record<number, { v: number; k: "m" | "c" }[]> = {};
                const add = (d: number, v: number, k: "m" | "c") => (cell[d] ||= []).push({ v, k });
                if (x.pMat.length) x.pMat.forEach((d) => add(d, x.mat / x.pMat.length, "m"));
                else add(0, x.mat, "m");
                if (hasC) {
                  if (x.pCompl.length) x.pCompl.forEach((d) => add(d, x.C / x.pCompl.length, "c"));
                  else add(0, x.C, "c");
                }
                return (
                  <tr key={i}>
                    <td>
                      {i + 1}. {x.sc.nome}
                    </td>
                    {cols.map((d) => (
                      <td className="num" key={d}>
                        {cell[d] ? (
                          cell[d].map((c, j) => (
                            <div key={j} className={`cell-${c.k}`}>
                              {R(c.v)}
                            </div>
                          ))
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2 data-anim="rise">Alíquotas e taxas</h2>
        <div className="rates">
          <Rate t="ICMS" v={PCT(P.icms)} d={P.ded.icms ? "Retirado dos valores" : "Incluso nos valores"} on={P.ded.icms} />
          <Rate
            t={"PIS/COFINS · " + (P.regime === "real" ? "Lucro Real" : "Lucro Presumido")}
            v={PCT(P.regime === "real" ? P.pisReal : P.pisPres)}
            d={P.ded.pis ? "Retirado dos valores" : "Incluso nos valores"}
            on={P.ded.pis}
          />
          <Rate
            t="Taxa financeira"
            v={PCT(P.taxaFin)}
            d={(P.ded.fin ? "Retirada" : "Inclusa") + "; só nas parcelas a prazo"}
            on={P.ded.fin}
          />
          {hasC && <Rate t={cn} v={R(parseNum(P.compl.valor))} d={P.compl.descricao || "Somado a todos os cenários"} on={false} />}
        </div>
      </section>
    </>
  );
}

function Rate({ t, v, d, on }: { t: string; v: string; d: string; on: boolean }) {
  return (
    <div className={`rate${on ? " on" : ""}`} data-anim="panel">
      <div className="eyebrow">{t}</div>
      <div className="v">{v}</div>
      <div className="muted">{d}</div>
    </div>
  );
}
