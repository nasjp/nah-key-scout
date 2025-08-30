export const revalidate = 300;

export default function About() {
  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-10 flex flex-col gap-3">
      <h1 className="text-xl font-bold">NOT A HOTEL - THE KEY SCOUT</h1>
      <p>
        project by{" "}
        <a
          className="underline"
          href="https://github.com/nasjp"
          target="_blank"
          rel="noreferrer"
        >
          nasjp
        </a>
      </p>
      <p className="text-sm opacity-70">
        このサイトは非公式のファンプロジェクトです。
      </p>
    </div>
  );
}
