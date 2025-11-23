import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { type PortfolioItem } from "@shared/schema";
import PortfolioFilters from "@/components/PortfolioFilters";
import PortfolioDialog from "@/components/PortfolioDialog";
import PortfolioGallery from "@/components/PortfolioGallery";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";

const PAGE_SIZE = 12;

export default function Portfolio() {
  const qc = useQueryClient();
  const [filters, setFilters] = React.useState<{ masterId?: string; style?: string; q?: string }>({});
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<
    (PortfolioItem & { masterName?: string | null; thumbnail?: string | null }) | null
  >(null);

  const queryKey = React.useMemo(
    () => [
      "portfolio",
      "list",
      {
        masterId: filters.masterId ?? null,
        style: filters.style ?? null,
        q: filters.q ?? null,
        page,
        pageSize: PAGE_SIZE,
      },
    ],
    [filters.masterId, filters.style, filters.q, page],
  );

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey,
    queryFn: () => api.getPortfolio({ ...filters, page, pageSize: PAGE_SIZE }),
    placeholderData: (previousData) => previousData,
  });

  const pageCount = React.useMemo(() => {
    const total = data?.total ?? 0;
    const size = data?.pageSize ?? PAGE_SIZE;
    return total > 0 ? Math.ceil(total / size) : 1;
  }, [data?.total, data?.pageSize]);

  const paginationRange = React.useMemo(() => {
    const total = pageCount;
    const windowSize = 5;
    const effective = Math.min(windowSize, total);
    const offset = Math.max(0, Math.min(page - Math.ceil(effective / 2), total - effective));
    return Array.from({ length: effective }, (_, index) => offset + index + 1);
  }, [page, pageCount]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["portfolio", "list"] });
  };

  React.useEffect(() => {
    setPage(1);
  }, [filters.masterId, filters.style, filters.q]);

  React.useEffect(() => {
    if (data?.page && data.page !== page) {
      setPage(data.page);
    }
  }, [data?.page, page]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Портфолио студии</h1>
          <p className="text-sm text-white/60">
            Управляйте работами для админки и Telegram-бота: добавляйте фото и видео, привязывайте мастеров и стили.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isFetching} className="inline-flex items-center gap-2">
          <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Обновить
        </Button>
      </div>

      <PortfolioFilters value={filters} onChange={setFilters} onAdd={() => { setEditing(null); setOpen(true); }} />

      {isLoading ? (
        <Card className="grid gap-4 border-white/10 bg-black/20 p-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: PAGE_SIZE }).map((_, index) => (
            <Skeleton key={index} className="aspect-video w-full rounded-xl bg-white/10" />
          ))}
        </Card>
      ) : isError ? (
        <Alert variant="destructive" className="border border-red-500/40 bg-red-500/10 text-red-200">
          <AlertTitle>Не удалось загрузить портфолио</AlertTitle>
          <AlertDescription>{(error as any)?.message || "Попробуйте обновить страницу"}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>
              Показано {data?.portfolio.length ?? 0} из {data?.total ?? 0}
            </span>
            {data?.total ? <span>Страница {data?.page ?? page} из {pageCount}</span> : null}
          </div>

          <PortfolioGallery
            items={data?.portfolio ?? []}
            onDelete={async (id) => {
              await api.deletePortfolioItem(id);
              refresh();
            }}
            onEdit={(item) => {
              setEditing(item);
              setOpen(true);
            }}
          />

          {pageCount > 1 && (
            <Pagination className="pt-2">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.max(1, current - 1));
                    }}
                    className={(data?.page ?? page) <= 1 ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>

                {paginationRange.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      isActive={page === pageNumber}
                      onClick={(event) => {
                        event.preventDefault();
                        setPage(pageNumber);
                      }}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.min(pageCount, current + 1));
                    }}
                    className={(data?.page ?? page) >= pageCount ? "pointer-events-none opacity-50" : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

      <PortfolioDialog open={open} onClose={() => { setOpen(false); setEditing(null); }} onSaved={refresh} item={editing ?? undefined} />
    </div>
  );
}
