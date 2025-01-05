import * as R from "ramda";
import React, { JSX, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { FaCog } from "react-icons/fa";
import { Button, ButtonProps } from "../ui/button";
import { GameSettings, GameSettingsSchema, Item } from "@shared/game/types";
import { Switch } from "../ui/switch";
import {
  ControllerProps,
  FieldPath,
  FieldValues,
  useForm,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Slider } from "../ui/slider";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import ItemIcon from "./item-icon";

export type SettingsDialogButtonProps = {
  settings: GameSettings;
  onChangeSettings: (settings: Partial<GameSettings>) => unknown;
  canSave: boolean;
};

const SaveButton = React.memo(function SaveButton(props: ButtonProps) {
  const { disabled, ...rest } = props;
  const inner = (
    <Button disabled={disabled} {...rest}>
      Save changes
    </Button>
  );
  return !disabled ? (
    inner
  ) : (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild disabled={disabled}>
          <div>{inner}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Only the creator can change settings.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

// TODO: Only wrap tooltip around label
function SettingsFormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(props: ControllerProps<TFieldValues, TName> & { tooltip: string }) {
  const { render, tooltip, ...rest } = props;
  const wrappedRender = useCallback(
    (...args: Parameters<typeof render>) => (
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>{render(...args)}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    [render, tooltip]
  );

  return <FormField {...rest} render={wrappedRender} />;
}

function SettingsSwitchFormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: Omit<
    React.ComponentProps<typeof SettingsFormField<TFieldValues, TName>>,
    "render"
  > & { label: string }
) {
  const { disabled, label, ...rest } = props;
  return (
    <SettingsFormField
      {...rest}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 w-full">
          <FormLabel className="text-base">{label}</FormLabel>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              className="mx-2"
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SettingsSliderFormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: Omit<
    React.ComponentProps<typeof SettingsFormField<TFieldValues, TName>>,
    "render"
  > & { label: string; min: number; max: number }
) {
  const { disabled, label, min, max, ...rest } = props;
  return (
    <SettingsFormField
      {...rest}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 w-full space-x-2">
          <FormLabel className="text-base grow">{label}</FormLabel>
          <span>{field.value}</span>
          <FormControl>
            <Slider
              value={[field.value]}
              onValueChange={(vals) => field.onChange(vals[0] ?? 0)}
              min={min}
              max={max}
              step={1}
              disabled={disabled}
              className="max-w-24"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SettingsMultiselectFormField<
  T extends string,
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: Omit<
    React.ComponentProps<typeof SettingsFormField<TFieldValues, TName>>,
    "render"
  > & { label: string; universe: T[]; renderItem: (x: T) => JSX.Element }
) {
  const { disabled, universe, label, renderItem, ...rest } = props;
  return (
    <SettingsFormField
      {...rest}
      render={({ field }) => (
        <FormItem className="flex flex-col items-center justify-between rounded-lg border p-4 w-full space-x-2">
          <FormLabel className="text-base grow">{label}</FormLabel>
          <FormControl>
            <ToggleGroup
              type="multiple"
              onValueChange={field.onChange}
              value={field.value}
              className="grid grid-cols-4 grid-flow-row"
            >
              {universe.map((item) => (
                <ToggleGroupItem key={item} disabled={disabled} value={item}>
                  {renderItem(item)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const SettingsDialogButton = React.memo(function (
  props: SettingsDialogButtonProps
) {
  const { onChangeSettings, settings, canSave } = props;
  const form = useForm<z.infer<typeof GameSettingsSchema>>({
    resolver: zodResolver(GameSettingsSchema),
    defaultValues: settings,
  });

  useEffect(() => {
    console.log("settings", settings);
    for (const [k, v] of Object.entries(settings)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.setValue(k as any, v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon">
          <FaCog />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Change settings here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onChangeSettings)}
            className="space-y-6"
          >
            <div className="flex flex-col space-y-2">
              <SettingsSwitchFormField
                control={form.control}
                disabled={!canSave}
                name="stackHandsaws"
                tooltip="Allow players to stack handsaws. Stupidly unfair, not recommended."
                label="Stack handsaws"
              />
              <SettingsSliderFormField
                control={form.control}
                disabled={!canSave}
                name="handcuffCooldownTurns"
                tooltip="Number of turns to use a handcuff after it's been used."
                label="Handcuff cooldown"
                min={0}
                max={5}
              />
              <SettingsMultiselectFormField
                control={form.control}
                disabled={!canSave}
                name="itemDistribution"
                tooltip="Items in the game."
                label="Items"
                universe={Object.values(Item).filter((x) => x !== Item.nothing)}
                // TODO: Add description
                renderItem={(item) => <ItemIcon item={item} />}
              />
            </div>
            <DialogFooter>
              <SaveButton type="submit" disabled={!canSave}>
                Save changes
              </SaveButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
});
SettingsDialogButton.displayName = "SettingsDialogButton";

export default SettingsDialogButton;
