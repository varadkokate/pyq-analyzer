import type { AnalysisResult, ModelAnswer } from '../types';

export type PrintMode = 'important' | 'mock';

interface PrintableReportProps {
  analysis: AnalysisResult;
  modelAnswers: Record<string, ModelAnswer>;
  printMode: PrintMode;
}

export function PrintableReport({
  analysis,
  modelAnswers,
  printMode,
}: PrintableReportProps) {
  const { summary, importantQuestions, topicWeightage, predictedMockPaper } = analysis;

  if (printMode === 'mock') {
    const hours = Math.floor(predictedMockPaper.durationMinutes / 60);
    const mins = predictedMockPaper.durationMinutes % 60;
    const durationLabel =
      hours > 0
        ? mins > 0
          ? `${hours} hr ${mins} min`
          : `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`
        : `${mins} Minutes`;

    return (
      <div className="print-only text-slate-900">
        <header className="pb-4 border-b-2 border-slate-900">
          <p className="text-xs text-slate-500">PYQ Analyzer — Predicted Practice Examination</p>
          <h1 className="mt-1 text-2xl font-bold">{predictedMockPaper.title}</h1>
          <div className="mt-1 flex items-baseline justify-between text-sm">
            <span>{predictedMockPaper.subtitle || summary.examTag}</span>
            <span className="font-mono tabular-nums">
              Time: {durationLabel} · Max Marks: {predictedMockPaper.totalMarks}
            </span>
          </div>
          {predictedMockPaper.generalInstructions.length > 0 && (
            <ul className="mt-3 text-xs text-slate-700 list-disc pl-4 space-y-0.5">
              {predictedMockPaper.generalInstructions.map((inst, i) => (
                <li key={i}>{inst}</li>
              ))}
            </ul>
          )}
        </header>

        <div className="mt-6 space-y-6">
          {predictedMockPaper.sections.map((section, sIdx) => (
            <section key={sIdx}>
              <div className="pb-1.5 border-b border-slate-300 flex items-baseline justify-between">
                <h2 className="text-base font-bold">{section.sectionName}</h2>
                <span className="text-xs text-slate-600">{section.instructions}</span>
              </div>
              <ol className="mt-3 space-y-3">
                {section.questions.map((q, qIdx) => (
                  <li key={qIdx} className="print-break-inside-avoid flex items-start justify-between gap-4 text-sm">
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono font-semibold">{q.number}</span>
                      <span>{q.questionText}</span>
                    </div>
                    <span className="font-mono font-semibold shrink-0">[{q.marks}]</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="print-only text-slate-900">
      <header className="pb-4 border-b-2 border-slate-900">
        <p className="text-xs text-slate-500">PYQ Analyzer — Important Questions Sheet</p>
        <h1 className="mt-1 text-2xl font-bold">{summary.subjectName}</h1>
        <p className="mt-0.5 text-sm text-slate-700">
          {summary.examTag} · {summary.totalPapersAnalyzed} Papers Analyzed ·{' '}
          {summary.totalUniqueConcepts} Ranked Concepts · {summary.highPriorityCount} High Priority
        </p>
        <p className="mt-2 text-xs text-slate-600 leading-relaxed">{summary.keyInsight}</p>
      </header>

      {/* Topic Weightage Summary Table */}
      {topicWeightage.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-bold pb-1.5 border-b border-slate-300">
            Topic-Wise Weightage
          </h2>
          <table className="w-full mt-2 text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-left">
                <th className="py-1.5">Topic / Unit</th>
                <th className="py-1.5 text-right">Weightage</th>
                <th className="py-1.5 text-right">Questions</th>
                <th className="py-1.5 text-right">Est. Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {topicWeightage.map((item) => (
                <tr key={item.topic}>
                  <td className="py-1.5">{item.topic}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{item.percentage}%</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{item.questionCount}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{item.totalMarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Ranked Important Questions */}
      <section className="mt-6">
        <h2 className="text-sm font-bold pb-1.5 border-b border-slate-300">
          Ranked Important Questions
        </h2>
        <div className="mt-3 divide-y divide-slate-200">
          {importantQuestions.map((q) => {
            const answer = modelAnswers[q.id];
            return (
              <article key={q.id} className="py-3 print-break-inside-avoid">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-xs font-bold pt-0.5">
                      {String(q.rank).padStart(2, '0')}.
                    </span>
                    <div>
                      <p className="text-sm font-medium leading-snug">{q.questionText}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {q.priority} Priority · {q.topic} · Appeared {q.frequencyCount}× (
                        {q.appearedIn.join(', ')})
                      </p>
                      {q.studyTip && (
                        <p className="mt-0.5 text-xs text-slate-500">Focus: {q.studyTip}</p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-semibold shrink-0">
                    {q.marksLabel || `${q.estimatedMarks}M`}
                  </span>
                </div>

                {answer && (
                  <div className="mt-2 ml-6 p-3 border border-slate-300 rounded text-xs space-y-1.5">
                    <p className="font-semibold">Model Answer:</p>
                    <p className="leading-relaxed whitespace-pre-line">{answer.directAnswer}</p>
                    {answer.keyPoints.length > 0 && (
                      <ul className="list-disc pl-4 space-y-0.5">
                        {answer.keyPoints.map((pt, idx) => (
                          <li key={idx}>{pt}</li>
                        ))}
                      </ul>
                    )}
                    {answer.formulaOrDiagramNote && (
                      <p className="font-mono pt-1">Note: {answer.formulaOrDiagramNote}</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
