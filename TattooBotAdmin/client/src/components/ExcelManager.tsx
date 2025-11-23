import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export function ExcelManager() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleImport = async () => {
    if (!selectedFile) {
      toast({ title: "Выберите файл", variant: "destructive" });
      return;
    }

    try {
      setIsImporting(true);
      const result = await api.importExcel(selectedFile);
      toast({
        title: "Импорт завершен",
        description: `Добавлено: ${result.imported}, пропущено: ${result.skipped}`,
      });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      toast({
        title: "Ошибка импорта",
        description: error instanceof Error ? error.message : "Не удалось импортировать данные",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const blob = await api.exportExcel({
        from: exportFrom || undefined,
        to: exportTo || undefined,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bookings.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Экспорт выполнен" });
    } catch (error) {
      toast({
        title: "Ошибка экспорта",
        description: error instanceof Error ? error.message : "Не удалось экспортировать данные",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Импорт/Экспорт Excel</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Импорт данных
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Загрузить расписание мастеров</Label>
              <div className="flex gap-2">
                <Input
                  id="import-file"
                  type="file"
                  accept=".xlsx,.xls"
                  data-testid="input-import-file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary hover:bg-accent/50 transition-colors cursor-pointer hover-elevate"
              data-testid="dropzone-import"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {selectedFile ? selectedFile.name : "Перетащите Excel файл сюда"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                или нажмите для выбора
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleImport}
              data-testid="button-import"
              disabled={isImporting}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? "Импорт..." : "Импортировать"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Экспорт данных
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="export-from">Период экспорта</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  id="export-from"
                  type="date"
                  data-testid="input-export-from"
                  value={exportFrom}
                  onChange={(event) => setExportFrom(event.target.value)}
                />
                <Input
                  id="export-to"
                  type="date"
                  data-testid="input-export-to"
                  value={exportTo}
                  onChange={(event) => setExportTo(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">Данные для экспорта:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Записи клиентов</li>
                <li>• Информация о мастерах</li>
                <li>• Расписание услуг</li>
              </ul>
            </div>

            <Button
              className="w-full"
              onClick={handleExport}
              data-testid="button-export"
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Экспорт..." : "Экспортировать"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
