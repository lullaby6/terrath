Drop mods here. Each mod is a folder:

  mods/
    my_mod/
      data/
        tile/ruby_ore.json
        entity/goblin.json
        function/explode.ts
      assets/
        images/tile/ruby_ore.png

Mods are loaded at runtime and layered on top of the base game (namespace
"terrath"). A mod's own content uses its folder name as its namespace.
