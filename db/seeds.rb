# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

puts "═══════════════════════════════════════════════════"
puts " FactorFifty — Seeding database"
puts "═══════════════════════════════════════════════════"

load Rails.root.join("db/seeds/tenant_hierarchy.rb")
load Rails.root.join("db/seeds/module_zones.rb")
load Rails.root.join("db/seeds/business_rules.rb")
load Rails.root.join("db/seeds/resources.rb")

puts "═══════════════════════════════════════════════════"
puts " Done."
puts "═══════════════════════════════════════════════════"
