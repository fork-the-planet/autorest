import "@typespec/rest";
import "@typespec/http";

using TypeSpec.Rest;
using TypeSpec.Http;

namespace AutoRestComplexTestService;

union CmykColors {
  string,
  cyan: "cyan",
  Magenta: "Magenta",
  YELLOW: "YELLOW",
  blacK: "blacK",
}

union MyKind {
  string,
  Kind1: "Kind1",
}

/**
 * Colors possible
 */
union GoblinSharkColor {
  string,
  pink: "pink",
  gray: "gray",
  brown: "brown",

  /**
   * Uppercase RED
   */
  upperRed: "RED",

  /**
   * Lowercase RED
   */
  lowerRed: "red",
}

model Basic {
  /**
   * Basic Id
   */
  id?: int32;

  /**
   * Name property with a very long description that does not fit on a single line
   * and a line break.
   */
  name?: string;

  color?: CmykColors;
}

@error
model Error {
  status?: int32;
  message?: string;
}

model IntWrapper {
  field1?: int32;
  field2?: int32;
}

model LongWrapper {
  field1?: int64;
  field2?: int64;
}

model FloatWrapper {
  field1?: float32;
  field2?: float32;
}

model DoubleWrapper {
  field1?: float64;
  field_56_zeros_after_the_dot_and_negative_zero_before_dot_and_this_is_a_long_field_name_on_purpose?: float64;
}

model BooleanWrapper {
  field_true?: boolean;
  field_false?: boolean;
}

model StringWrapper {
  field?: string;
  empty?: string;
  null?: string;
}

model DateWrapper {
  field?: plainDate;
  leap?: plainDate;
}

model DatetimeWrapper {
  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  field?: utcDateTime;

  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  now?: utcDateTime;
}

model Datetimerfc1123Wrapper {
  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  field?: utcDateTime;

  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  now?: utcDateTime;
}

model DurationWrapper {
  field?: duration;
}

model ByteWrapper {
  field?: bytes;
}

model ArrayWrapper {
  array?: string[];
}

model DictionaryWrapper {
  /**
   * Dictionary of <string>
   */
  defaultProgram?: Record<string>;
}

#suppress "@azure-tools/typespec-azure-core/composition-over-inheritance" "For backward compatibility"
model Siamese extends Cat {
  breed?: string;
}

#suppress "@azure-tools/typespec-azure-core/composition-over-inheritance" "For backward compatibility"
model Cat extends Pet {
  color?: string;
  hates?: Dog[];
}

#suppress "@azure-tools/typespec-azure-core/composition-over-inheritance" "For backward compatibility"
model Dog extends Pet {
  food?: string;
}

model Pet {
  id?: int32;
  name?: string;
}

@discriminator("fishtype")
model Fish {
  fishtype: string;
  species?: string;

  // FIXME: (resource-key-guessing) - Verify that this property is the resource key, if not please update the model with the right one
  @key
  length: float32;

  siblings?: Fish[];
}

@discriminator("fish.type")
model DotFish {
  `fish.type`: string;
  species?: string;
}

model DotFishMarket {
  sampleSalmon?: DotSalmon;
  salmons?: DotSalmon[];
  sampleFish?: DotFish;
  fishes?: DotFish[];
}

model DotSalmon extends DotFish {
  location?: string;
  iswild?: boolean;
  `fish.type`: "DotSalmon";
}

@discriminator("fishtype")
model Salmon extends Fish {
  location?: string;
  iswild?: boolean;
}

model ReadonlyObj {
  @visibility(Lifecycle.Read)
  id?: string;

  size?: int32;
}

@discriminator("kind")
model MyBaseType {
  kind: MyKind;
  propB1?: string;
  helper?: MyBaseHelperType;
}

model MyBaseHelperType {
  propBH1?: string;
}

model SmartSalmon extends Salmon {
  ...Record<unknown>;
  college_degree?: string;
  fishtype: "smart_salmon";
}

@discriminator("fishtype")
model Shark extends Fish {
  age?: int32;

  // FIXME: (utcDateTime) Please double check that this is the correct type for your scenario.
  birthday: utcDateTime;
}

model Sawshark extends Shark {
  picture?: bytes;
  fishtype: "sawshark";
}

model Goblinshark extends Shark {
  jawsize?: int32;

  /**
   * Colors possible
   */
  color?: GoblinSharkColor = GoblinSharkColor.gray;

  fishtype: "goblin";
}

model Cookiecuttershark extends Shark {
  fishtype: "cookiecuttershark";
}

model MyDerivedType extends MyBaseType {
  propD1?: string;
  kind: "Kind1";
}
