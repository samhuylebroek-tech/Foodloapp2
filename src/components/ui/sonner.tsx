import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      // V2: leesbaar voor iedereen — 18 px tekst en eigen kleuren met voldoende
      // contrast (de standaard "richColors" gaf o.a. blauw op lichtblauw, 3,4:1).
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:flex-wrap group-[.toaster]:rounded-2xl group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:p-4 group-[.toaster]:text-base group-[.toaster]:text-foreground group-[.toaster]:shadow-zwevend",
          // Tekst krijgt minstens 11 rem; anders gaat de knop (bv. "Ongedaan maken") eronder
          // in plaats van woorden middenin te breken ("Chocoladem-ousse").
          content: "group-[.toast]:min-w-44 group-[.toast]:flex-1",
          title: "group-[.toast]:text-base group-[.toast]:font-semibold",
          description: "group-[.toast]:text-base group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:!ml-auto group-[.toast]:!min-h-10 group-[.toast]:!rounded-xl group-[.toast]:!bg-primary group-[.toast]:!px-3 group-[.toast]:!text-base group-[.toast]:!text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!border-l-[6px] group-[.toaster]:!border-l-success",
          error: "group-[.toaster]:!border-l-[6px] group-[.toaster]:!border-l-destructive",
          warning: "group-[.toaster]:!border-l-[6px] group-[.toaster]:!border-l-warning",
          info: "group-[.toaster]:!border-l-[6px] group-[.toaster]:!border-l-primary",
          icon: "group-[.toast]:!size-6",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
