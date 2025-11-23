import { PortfolioGallery } from "../PortfolioGallery";
import img1 from "@assets/stock_images/professional_black_a_90891ff2.jpg";
import img2 from "@assets/stock_images/professional_black_a_7391229a.jpg";
import img3 from "@assets/stock_images/professional_black_a_5bab91ea.jpg";
import img4 from "@assets/stock_images/realistic_tattoo_por_d2e8434e.jpg";
import img5 from "@assets/stock_images/realistic_tattoo_por_c2c66c27.jpg";

const mockImages = [
  { id: "1", url: img1, title: "Геометрия" },
  { id: "2", url: img2, title: "Минимализм" },
  { id: "3", url: img3, title: "Блэкворк" },
  { id: "4", url: img4, title: "Реализм" },
  { id: "5", url: img5, title: "Портрет" },
];

export default function PortfolioGalleryExample() {
  return (
    <div className="p-6">
      <PortfolioGallery
        images={mockImages}
        onAdd={() => console.log("Add image")}
        onDelete={(id) => console.log("Delete image:", id)}
      />
    </div>
  );
}
