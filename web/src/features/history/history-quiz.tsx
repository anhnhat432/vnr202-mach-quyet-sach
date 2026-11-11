"use client";

import { useState } from "react";
import type { HistoryEvent } from "./types";

export function HistoryQuiz({ questions }: { questions: HistoryEvent["quiz"] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  return (
    <section className="history-quiz" aria-labelledby="history-quiz-title">
      <p className="history-kicker">Thử nhớ lại · không tính điểm</p>
      <h3 id="history-quiz-title">Kiểm tra nhanh</h3>
      {questions.length === 0 && <p>Câu hỏi cho sự kiện này đang được bổ sung.</p>}
      {questions.map((quiz, index) => (
        <fieldset key={quiz.question}>
          <legend>{quiz.question}</legend>
          <div className="history-quiz__options">
            {quiz.options.map((option, optionIndex) => (
              <button key={option} type="button" disabled={answers[index] !== undefined} data-result={answers[index] === undefined ? undefined : optionIndex === quiz.answer ? "correct" : answers[index] === optionIndex ? "wrong" : undefined} onClick={() => setAnswers(current => ({ ...current, [index]: optionIndex }))}>
                <span aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span>{option}
                {answers[index] !== undefined && optionIndex === quiz.answer && <b> ✓ Đáp án đúng</b>}
                {answers[index] === optionIndex && optionIndex !== quiz.answer && <b> ✕ Bạn đã chọn</b>}
              </button>
            ))}
          </div>
          {answers[index] !== undefined && (
            <p className="history-quiz__feedback" role="status">
              <strong>{answers[index] === quiz.answer ? "Chính xác. " : "Chưa đúng. "}</strong>{quiz.explanation}
            </p>
          )}
        </fieldset>
      ))}
      {Object.keys(answers).length > 0 && <button className="history-text-button" type="button" onClick={() => setAnswers({})}>Làm lại câu hỏi</button>}
    </section>
  );
}
