# Breaking Changes: Person Profiles Removed

## Summary
Person profiles have been fully removed and replaced with the owner concept. All accounts now use owner names (e.g., "Ranbir", "Sarah") directly.

## Migration Completed
- ✅ All accounts with owner "RS" automatically migrated to "Ranbir" on app load
- ✅ Person profiles removed from Household type
- ✅ Settings page now manages owners directly (no person profiles UI)
- ✅ Account grouping uses owner names
- ✅ All display text uses owner names

## What WILL Break (Requires Manual Review)

### 1. Existing Projection Scenarios
**Status: ⚠️ BREAKING - Requires Migration**

Existing projection scenarios that use `person1`/`person2` keys in assumptions will continue to work due to backward compatibility, but:

- **Income/Expenses**: Scenarios with `income.person1` or `income.person2` will still work, but new inputs should use owner names
- **CPP/OAS Benefits**: Scenarios with `cpp.person1`, `cpp.person2`, `oas.person1`, `oas.person2` will still work
- **Contribution Rooms**: Scenarios with `contributionRooms.rrsp.person1`, `contributionRooms.tfsa.person1`, etc. will still work
- **Retirement Ages**: `retirement.targetRetirementAge2` (secondary earner) will still work

**Action Required**: 
- Existing scenarios will continue to function
- When editing scenarios, the UI will show owner names but save to person1/person2 keys for compatibility
- To fully migrate, you would need to manually update each scenario's assumptions to use owner names as keys

### 2. Projection Calculation Logic
**Status: ✅ COMPATIBLE - Backward Compatible**

The projection calculation in `src/utils/projections.ts` still uses `person1`/`person2` keys internally. This is intentional for backward compatibility.

**What Works**:
- Existing scenarios continue to calculate correctly
- New scenarios can use owner names, which map to person1/person2

**What Doesn't Work**:
- You cannot have more than 2 people with separate income/expense tracking (limited to person1/person2)
- Owner names beyond the first two map to person1/person2 based on matching

### 3. Account Owner Field
**Status: ✅ MIGRATED**

- All accounts now use owner names directly
- RS accounts automatically converted to "Ranbir"
- Account grouping works with any owner names

### 4. Settings Page
**Status: ✅ MIGRATED**

- Person Profiles section replaced with Owners management
- Owners can be added/removed/renamed
- "Joint" and "Household" are always available and cannot be removed

## What CANNOT Be Unbroken

### 1. Projection Assumptions Structure
**Cannot Change**: The `ProjectionAssumptions` type still uses `person1`/`person2` keys in:
- `income.person1` / `income.person2`
- `cpp.person1` / `cpp.person2`  
- `oas.person1` / `oas.person2`
- `contributionRooms.rrsp.person1` / `contributionRooms.rrsp.person2`
- `contributionRooms.tfsa.person1` / `contributionRooms.tfsa.person2`
- `retirement.targetRetirementAge2`

**Why**: Changing this would break all existing projection scenarios. The current approach maintains backward compatibility by:
- UI uses owner names
- Saving maps owner names to person1/person2 keys
- Reading checks both owner name keys and person1/person2 keys

### 2. Two-Person Limit in Projections
**Cannot Change**: The projection calculation logic assumes a maximum of 2 people for:
- Separate income tracking
- Separate expense tracking
- Separate CPP/OAS benefits
- Separate retirement ages

**Why**: The calculation engine is built around person1/person2. Supporting unlimited people would require a complete rewrite of the projection logic.

### 3. Legacy Data Compatibility
**Cannot Remove**: Support for `person1`/`person2` keys must remain for:
- Loading existing projection scenarios
- Backward compatibility with saved data

## Recommendations

1. **For New Users**: Use owner names directly. The system will map them to person1/person2 internally.

2. **For Existing Users**: 
   - Your existing scenarios will continue to work
   - When creating new scenarios, use owner names
   - Consider recreating scenarios if you want to use owner names directly

3. **For Future Development**: 
   - If you need more than 2 people with separate tracking, the projection calculation logic would need to be refactored
   - Consider a migration tool to convert person1/person2 keys to owner name keys in existing scenarios

## Migration Script

A migration script is available at `migrate-rs-to-ranbir.js` that can be run in the browser console to:
- Update RS accounts to Ranbir
- Remove personProfiles from household
- Update owners array

Run it once, then the app will handle future migrations automatically.

