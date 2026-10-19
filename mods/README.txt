Drop mods here. Each mod is a folder, and the folder name is the mod's namespace:

  mods/
    my_mod/
      data/
        tile/crystal.json            -> my_mod:crystal
        entity/goblin.json           -> my_mod:goblin
        function/entity/wander.ts    -> my_mod:wander
      assets/
        images/block/crystal.png     -> texture my_mod:crystal
      override/terrath/...           -> replace base game files
      patch/terrath/...              -> change some fields of base game files

Inside a mod, an id without a namespace ("crystal") means the mod's own content
if it exists, otherwise the base game's ("terrath:crystal").

See example_mod for a working mod, and MODDING.md in the project root for the
full guide.
