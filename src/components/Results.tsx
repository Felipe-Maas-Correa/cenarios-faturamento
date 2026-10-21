import { analyse } from "@/lib/calc";
import { PCT, parseNum, prazoTxt, R } from "@/lib/format";
import { cronograma, difalPendentes, motivosMelhor, rotuloDia } from "@/lib/report";
import { CountUp } from "./CountUp";
import { Icon } from "./ui";
import type { Projeto } from "@/lib/types";

type Editar = (a: "cenarios" | "impostos") => void;

export function Alerts({ P, onEditar }: { P: Projeto; onEditar?: Editar }) {
  const { res } = analyse(P);
  const cred = res.filter((x) => x.sc.credito).map((x) => x.sc.nome);
  const difal = difalPendentes(P);
  return (
    <div className="alerts">
      {difal.length > 0 && (
        <div className="alert bad">
          <Icon name="warn" size={18} className="ai" />
          <span>
            <b>DIFAL não definido{P.ufCliente ? ` (cliente em ${P.ufCliente})` : ""}:</b> {difal.join("; ")}. No faturamento
            direto é preciso informar se o DIFAL fica por conta do cliente ou por nossa conta. Enquanto isso, a proposta não é
            recomendada.
          </span>
          {onEditar && (
            <button className="btn sm alert-cta" onClick={() => onEditar("cenarios")}>
              Definir DIFAL
            </button>
          )}
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

export function Results({ P, onEditar }: { P: Projeto; onEditar: Editar }) {
  const A = analyse(P);
  const { res, best, recomendada } = A;
  const cn = P.compl.fornecedor || "Item complementar";
  const hasC = parseNum(P.compl.valor) > 0;
  const hasDireto = res.some((x) => x.sc.modal === "direto");
  const off = (b: boolean) => (b ? "" : "off");
  const cr = cronograma(P);

  return (
    <>
      <section className="section">
        <h2 data-anim="rise">Cenários</h2>
        <div className="cards">
          {res.length === 0 && (
            <p className="hint">Nenhum cenário cadastrado. Abra a edição e clique em Adicionar cenário.</p>
          )}
          {res.map((x, i) => {
            const isRec = A.comparavel && x === recomendada;
            const isMenor = A.comparavel && x === best && !isRec;
            const ded = P.ded.icms || P.ded.pis || P.ded.fin;
            return (
              <article className={`card${isRec ? " best" : ""}`} key={i} data-anim="panel">
                <div className="card-h">
                  <div>
                    <div className="eyebrow">Cenário {i + 1}</div>
                    <h3>{x.sc.nome}</h3>
                  </div>
                  <button className="btn ghost sm" onClick={() => onEditar("cenarios")} aria-label={`Editar ${x.sc.nome}`}><Icon name="edit" size={13} /> Editar</button>
                </div>
                <div className="tags">
                  {isRec && <span className="tag good">Recomendada</span>}
                  {isMenor && <span className="tag acc">Menor custo</span>}
                  <span className="tag acc">{x.sc.modal === "direto" ? "Direto ao cliente" : "Via Alpha Filial"}</span>
                  {x.sc.credito && <span className="tag warn">Crédito em análise</span>}
                  {x.difalStatus === "pendente" && <span className="tag bad">DIFAL não definido</span>}
                  {x.difalStatus === "cliente" && <span className="tag acc">DIFAL do cliente</span>}
                  {x.difalStatus === "nos" && <span className="tag warn">DIFAL por nossa conta</span>}
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
                  {x.difal > 0 && (
                    <div className="row inc">
                      <span>DIFAL {PCT(parseNum(x.sc.difalPct))} (nosso)</span>
                      <span className="num">+{R(x.difal)}</span>
                    </div>
                  )}
                  <div className="row total">
                    <span>{ded || x.difal > 0 ? "Valor líquido" : "Valor total"}</span>
                    <CountUp className="big" value={x.liq} />
                  </div>
                  <div className="row sub">
                    <span>Prazo médio</span>
                    <span className="num">{x.prazoMedio < 0.5 ? "à vista" : `${Math.round(x.prazoMedio)} dias`}</span>
                  </div>
                  <div className="row eff">
                    <span>Custo efetivo (valor presente)</span>
                    <span className="num">{R(x.vp)}</span>
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
                {isRec && (
                  <div className="why">
                    <b>Por que é a recomendada</b>
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
        <h2 data-anim="rise">Comparativo detalhado</h2>
        <div className="tbl-wrap" data-anim="rise">
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
                {hasDireto && <th>DIFAL</th>}
                <th>Líquido</th>
                <th>Prazo médio</th>
                <th>Custo efetivo</th>
                <th>Cond. materiais</th>
                {hasC && <th>Cond. {cn}</th>}
              </tr>
            </thead>
            <tbody>
              {res.map((x, i) => (
                <tr key={i} className={x === recomendada && A.comparavel ? "best-row" : ""}>
                  <td>
                    {i + 1}. {x.sc.nome}
                  </td>
                  <td className="num">{R(x.mat)}</td>
                  {hasC && <td className="num cell-c">{R(x.C)}</td>}
                  <td className="num">{R(x.bruto)}</td>
                  <td className={`num ${off(P.ded.icms)}`}>{R(x.icms)}</td>
                  <td className={`num ${off(P.ded.pis)}`}>{R(x.pis)}</td>
                  <td className={`num ${off(P.ded.fin)}`}>{x.fin ? R(x.fin) : "—"}</td>
                  {hasDireto && (
                    <td className={`num${x.difalStatus === "pendente" ? " warn-t" : ""}`}>
                      {x.difalStatus === null ? "—" : x.difalStatus === "pendente" ? "Não definido" : x.difalStatus === "cliente" ? "Do cliente" : R(x.difal)}
                    </td>
                  )}
                  <td className="num">
                    <b>{R(x.liq)}</b>
                  </td>
                  <td className="num">{x.prazoMedio < 0.5 ? "à vista" : `${Math.round(x.prazoMedio)} d`}</td>
                  <td className="num">
                    <b>{R(x.vp)}</b>
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
        <div className="tbl-wrap" data-anim="rise">
          <table>
            <thead>
              <tr>
                <th>Cenário</th>
                {cr.cols.map((d) => (
                  <th key={d}>{rotuloDia(d)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {res.map((x, i) => {
                const mat = cr.linhas[hasC ? i * 2 : i];
                const cmp = hasC ? cr.linhas[i * 2 + 1] : null;
                return (
                  <tr key={i}>
                    <td>
                      {i + 1}. {x.sc.nome}
                    </td>
                    {cr.cols.map((d) => (
                      <td className="num" key={d}>
                        {mat.parcelas[d] || cmp?.parcelas[d] ? (
                          <>
                            {mat.parcelas[d] ? <div className="cell-m">{R(mat.parcelas[d])}</div> : null}
                            {cmp?.parcelas[d] ? <div className="cell-c">{R(cmp.parcelas[d])}</div> : null}
                          </>
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
          <Rate t="Custo de capital" v={PCT(A.taxa * 100)} d="Ao mês; usado no valor presente" on={false} />
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
