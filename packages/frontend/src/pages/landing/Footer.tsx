export function Footer() {
  return (
    <footer className="py-10 px-4 border-t border-border/30">
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm text-muted-foreground">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <img src="/assets/LogoAlt.svg" alt="Polka" className="h-6 w-6" />
            <span className="font-semibold text-foreground">Polka</span>
          </div>
          <p className="leading-relaxed">
            Платформа для открытия уникальных независимых брендов
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
            Продукт
          </h4>
          <ul className="space-y-1.5">
            <li>
              <a href="#" className="hover:text-foreground transition-colors">
                Как это работает
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-foreground transition-colors">
                Скачать приложение
              </a>
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
            Для брендов
          </h4>
          <ul className="space-y-1.5">
            <li>
              <a
                href="/portal"
                className="hover:text-foreground transition-colors"
              >
                Портал брендов
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-foreground transition-colors">
                Стать партнёром
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-8 pt-6 border-t border-border/20 text-center text-xs text-muted-foreground/60">
        &copy; {new Date().getFullYear()} Polka. Все права защищены.
      </div>
    </footer>
  );
}
