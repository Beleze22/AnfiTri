import { PropertyCreateForm } from "@/components/manager/PropertyCreateForm";

export default function NovaHospedagemPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-5 text-page-title font-semibold text-text-primary">
        Nova hospedagem
      </h1>
      <PropertyCreateForm />
    </div>
  );
}
